import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErrorSchema, ListConversationsResponseSchema } from "@askwell/shared";

vi.mock("server-only", () => ({}));

const getOwnedProject = vi.fn();
vi.mock("../../../../../lib/projects", () => ({ getOwnedProject: (id: string) => getOwnedProject(id) }));
const listProjectConversations = vi.fn();
vi.mock("../../../../../lib/conversations", () => ({
  listProjectConversations: (id: string) => listProjectConversations(id),
}));
const createServiceClient = vi.fn();
vi.mock("../../../../../lib/supabase/service", () => ({ createServiceClient: () => createServiceClient() }));

import { GET } from "./route";

const ID = "11111111-1111-4111-8111-111111111111";
const OTHER_OWNERS = "99999999-9999-4999-8999-999999999999";
const get = (id: string) =>
  GET(new Request(`http://localhost/api/projects/${id}/conversations`), { params: Promise.resolve({ id }) });
const errorCode = async (res: Response) => ApiErrorSchema.parse(await res.json()).error.code;

const newer = {
  id: "22222222-2222-4222-8222-222222222222",
  visitorId: "v-new",
  firstMessagePreview: "Do you ship abroad?",
  messageCount: 2,
  createdAt: "2026-11-12T12:00:00+00:00",
};
const older = {
  id: "33333333-3333-4333-8333-333333333333",
  visitorId: "v-old",
  firstMessagePreview: "Refund policy?",
  messageCount: 6,
  createdAt: "2026-11-12T10:00:00+00:00",
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  getOwnedProject.mockReset().mockImplementation(async (id: string) => (id === ID ? { id } : null));
  listProjectConversations.mockReset().mockResolvedValue([newer, older]);
  createServiceClient.mockReset();
});

describe("GET /api/projects/:id/conversations", () => {
  it("returns the conversations newest first with preview and count", async () => {
    const res = await get(ID);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = ListConversationsResponseSchema.parse(await res.json());
    expect(body.conversations).toEqual([newer, older]);
    expect(listProjectConversations).toHaveBeenCalledWith(ID);
  });
  it("returns an empty list for an owned project with no conversations", async () => {
    listProjectConversations.mockResolvedValue([]);
    const res = await get(ID);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ conversations: [] });
  });
  it("returns 404 for another owner's project and reads nothing", async () => {
    const res = await get(OTHER_OWNERS);
    expect(res.status).toBe(404);
    expect(await errorCode(res)).toBe("not_found");
    expect(listProjectConversations).not.toHaveBeenCalled();
    expect(createServiceClient).not.toHaveBeenCalled();
  });
  it("returns 400 for an id that is not a UUID", async () => {
    const res = await get("not-a-uuid");
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("validation_failed");
    expect(getOwnedProject).not.toHaveBeenCalled();
  });
  it("returns 500 with a generic message on a database error", async () => {
    listProjectConversations.mockRejectedValue(new Error("db down"));
    const res = await get(ID);
    expect(res.status).toBe(500);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("internal");
    expect(body.error.message).not.toContain("db down");
  });
});
