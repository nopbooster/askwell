import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErrorSchema, UpdateConfigResponseSchema } from "@askwell/shared";

vi.mock("server-only", () => ({}));

const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));

const getOwnerPlan = vi.fn();
vi.mock("../../../../../lib/accounts", () => ({ getOwnerPlan: () => getOwnerPlan() }));

const getOwnedProject = vi.fn();
vi.mock("../../../../../lib/projects", () => ({ getOwnedProject: (id: string) => getOwnedProject(id) }));

// Service client: from("widget_configs").upsert(row, opts).select(cols).single()
const upsert = vi.fn();
const single = vi.fn();
const serviceFrom = vi.fn<(table: string) => unknown>(() => ({
  upsert: (row: unknown, opts: unknown) => {
    upsert(row, opts);
    return { select: () => ({ single: () => single() }) };
  },
}));
const createServiceClient = vi.fn(() => ({ from: serviceFrom }));
vi.mock("../../../../../lib/supabase/service", () => ({ createServiceClient: () => createServiceClient() }));

import { PATCH } from "./route";

const ID = "11111111-1111-4111-8111-111111111111";
const STORED = {
  button_color: "#ff0000",
  position: "top-left",
  label: "Help",
  animation: "slide",
  header_text: "Ask us anything",
  show_badge: false,
};
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const patch = (body: unknown, id = ID) =>
  PATCH(
    new Request(`http://localhost/api/projects/${id}/config`, {
      method: "PATCH",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    ctx(id),
  );
const errorOf = async (res: Response) => ApiErrorSchema.parse(await res.json()).error;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  auth.mockReset().mockResolvedValue({ userId: "user_1" });
  getOwnerPlan.mockReset().mockResolvedValue({ status: "ok", plan: "pro" });
  getOwnedProject.mockReset().mockResolvedValue({ id: ID, owner_id: "user_1" });
  upsert.mockReset();
  single.mockReset().mockResolvedValue({ data: STORED, error: null });
  serviceFrom.mockClear();
  createServiceClient.mockClear();
});

describe("PATCH /api/projects/:id/config", () => {
  it("Pro: saves only the sent fields with the service client and returns the config", async () => {
    const res = await patch({ buttonColor: "#ff0000", position: "top-left", label: "Help", animation: "slide", showBadge: false });
    expect(res.status).toBe(200);
    expect(UpdateConfigResponseSchema.parse(await res.json()).config).toEqual({
      buttonColor: "#ff0000",
      position: "top-left",
      label: "Help",
      animation: "slide",
      headerText: "Ask us anything",
      showBadge: false,
    });
    expect(serviceFrom).toHaveBeenCalledWith("widget_configs");
    expect(upsert).toHaveBeenCalledWith(
      { project_id: ID, button_color: "#ff0000", position: "top-left", label: "Help", animation: "slide", show_badge: false },
      { onConflict: "project_id" },
    );
  });

  it("checks ownership and the plan before the write", async () => {
    await patch({ label: "Help" });
    const writeOrder = createServiceClient.mock.invocationCallOrder[0] ?? 0;
    expect(getOwnedProject).toHaveBeenCalledWith(ID);
    expect(getOwnedProject.mock.invocationCallOrder[0]).toBeLessThan(writeOrder);
    expect(getOwnerPlan.mock.invocationCallOrder[0]).toBeLessThan(writeOrder);
  });

  it("Free: 402 payment_required and nothing is written", async () => {
    getOwnerPlan.mockResolvedValue({ status: "ok", plan: "free" });
    const res = await patch({ buttonColor: "#00ff00" });
    expect(res.status).toBe(402);
    expect((await errorOf(res)).code).toBe("payment_required");
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("Free: a plan claimed in the body changes nothing (still 402, still no write)", async () => {
    getOwnerPlan.mockResolvedValue({ status: "ok", plan: "free" });
    const res = await patch({ label: "Help", plan: "pro" });
    expect(res.status).toBe(402);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("another owner's project (or a missing one): 404, no plan read, no write", async () => {
    getOwnedProject.mockResolvedValue(null);
    const res = await patch({ label: "Help" });
    expect(res.status).toBe(404);
    expect((await errorOf(res)).code).toBe("not_found");
    expect(getOwnerPlan).not.toHaveBeenCalled();
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("invalid input: 400 validation_failed, nothing read or written", async () => {
    for (const body of [{}, { buttonColor: "green" }, { position: "middle" }, { animation: "spin" }, { label: "" }, { showBadge: "no" }, "not json"]) {
      const res = await patch(body);
      expect(res.status).toBe(400);
      expect((await errorOf(res)).code).toBe("validation_failed");
    }
    expect((await patch({ label: "Help" }, "not-a-uuid")).status).toBe(400);
    expect(getOwnedProject).not.toHaveBeenCalled();
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("signed out: 401 unauthorized before anything else", async () => {
    auth.mockResolvedValue({ userId: null });
    const res = await patch({ label: "Help" });
    expect(res.status).toBe(401);
    expect((await errorOf(res)).code).toBe("unauthorized");
    expect(getOwnedProject).not.toHaveBeenCalled();
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("500 with a generic message when the plan can't be read or the write fails", async () => {
    getOwnerPlan.mockResolvedValue({ status: "error" });
    expect((await patch({ label: "Help" })).status).toBe(500);
    expect(upsert).not.toHaveBeenCalled();

    getOwnerPlan.mockResolvedValue({ status: "ok", plan: "pro" });
    single.mockResolvedValue({ data: null, error: { message: "secret db detail" } });
    const res = await patch({ label: "Help" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret db detail");
  });
});
