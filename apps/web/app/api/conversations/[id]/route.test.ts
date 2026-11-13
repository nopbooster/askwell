import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErrorSchema, GetConversationResponseSchema } from "@askwell/shared";

vi.mock("server-only", () => ({}));

const getConversationThread = vi.fn();
vi.mock("../../../../lib/conversations", () => ({
  getConversationThread: (id: string) => getConversationThread(id),
}));
const createServiceClient = vi.fn();
vi.mock("../../../../lib/supabase/service", () => ({ createServiceClient: () => createServiceClient() }));

import { GET } from "./route";

const ID = "22222222-2222-4222-8222-222222222222";
const OTHER_OWNERS = "99999999-9999-4999-8999-999999999999";
const get = (id: string) => GET(new Request(`http://localhost/api/conversations/${id}`), { params: Promise.resolve({ id }) });
const errorCode = async (res: Response) => ApiErrorSchema.parse(await res.json()).error.code;

const THREAD = {
  conversation: {
    id: ID,
    visitorId: "v1",
    firstMessagePreview: "Hi there",
    messageCount: 3,
    createdAt: "2026-11-12T10:00:00+00:00",
  },
  messages: [
    { id: "a1111111-1111-4111-8111-111111111111", role: "visitor", body: "Hi there", createdAt: "2026-11-12T10:00:00+00:00" },
    { id: "a2222222-2222-4222-8222-222222222222", role: "bot", body: "<b>Hello!</b>", createdAt: "2026-11-12T10:00:01+00:00" },
    { id: "a3333333-3333-4333-8333-333333333333", role: "visitor", body: "Refunds?", createdAt: "2026-11-12T10:01:00+00:00" },
  ],
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  getConversationThread.mockReset().mockImplementation(async (id: string) => (id === ID ? THREAD : null));
  createServiceClient.mockReset();
});

describe("GET /api/conversations/:id", () => {
  it("returns the conversation and its messages in order", async () => {
    const res = await get(ID);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = GetConversationResponseSchema.parse(await res.json());
    expect(body.conversation).toEqual(THREAD.conversation);
    expect(body.messages.map((m) => `${m.role}:${m.body}`)).toEqual(["visitor:Hi there", "bot:<b>Hello!</b>", "visitor:Refunds?"]);
  });
  it("returns 404 for another owner's (or a missing) conversation", async () => {
    const res = await get(OTHER_OWNERS);
    expect(res.status).toBe(404);
    expect(await errorCode(res)).toBe("not_found");
    expect(createServiceClient).not.toHaveBeenCalled();
  });
  it("returns 400 for an id that is not a UUID", async () => {
    const res = await get("nope");
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("validation_failed");
    expect(getConversationThread).not.toHaveBeenCalled();
  });
  it("returns 500 with a generic message on a database error", async () => {
    getConversationThread.mockRejectedValue(new Error("db down"));
    const res = await get(ID);
    expect(res.status).toBe(500);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("internal");
    expect(body.error.message).not.toContain("db down");
  });
});
