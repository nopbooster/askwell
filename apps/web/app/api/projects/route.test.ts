import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErrorSchema, CreateProjectResponseSchema, ListProjectsResponseSchema, PLAN_LIMITS } from "@askwell/shared";
import { fakeQuery, type QueryResult } from "../../../lib/projects/test-helpers";

vi.mock("server-only", () => ({}));

const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));

const ensureAccount = vi.fn();
const getOwnerPlan = vi.fn();
vi.mock("../../../lib/accounts", () => ({
  ensureAccount: () => ensureAccount(),
  getOwnerPlan: () => getOwnerPlan(),
}));

let ownerResult: QueryResult = { data: [], error: null };
const ownerFrom = vi.fn(() => fakeQuery(ownerResult).builder);
vi.mock("../../../lib/supabase/owner", () => ({
  createOwnerClient: async () => ({ from: () => ownerFrom() }),
}));

const rpc = vi.fn();
const serviceFrom = vi.fn();
vi.mock("../../../lib/supabase/service", () => ({
  createServiceClient: () => ({ rpc: (...a: unknown[]) => rpc(...a), from: serviceFrom }),
}));

import { GET, POST } from "./route";

const ROW = {
  id: "11111111-1111-4111-8111-111111111111",
  owner_id: "user_1",
  name: "Site",
  public_key: "pk_abcdefghijklmnopqrstuvwx",
  messages_used: 3,
  period_start: "2026-11-01T00:00:00+00:00",
  created_at: "2026-11-12T10:00:00+00:00",
};
const post = (body: unknown) =>
  POST(new Request("http://localhost/api/projects", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  auth.mockReset().mockResolvedValue({ userId: "user_1" });
  ensureAccount.mockReset().mockResolvedValue(undefined);
  getOwnerPlan.mockReset().mockResolvedValue({ status: "ok", plan: "free" });
  rpc.mockReset().mockResolvedValue({ data: ROW, error: null });
  serviceFrom.mockReset();
  ownerResult = { data: [ROW], error: null };
  ownerFrom.mockClear();
});

describe("GET /api/projects", () => {
  it("lists the owner's projects, newest first, with the plan, via the owner client", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = ListProjectsResponseSchema.parse(await res.json());
    expect(body.plan).toBe("free");
    expect(body.projects[0]).toMatchObject({ id: ROW.id, publicKey: ROW.public_key, messagesLimit: PLAN_LIMITS.free.messagesPerMonth });
    expect(ownerFrom).toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(serviceFrom).not.toHaveBeenCalled();
  });

  it("uses the Pro message limit for a Pro owner", async () => {
    getOwnerPlan.mockResolvedValue({ status: "ok", plan: "pro" });
    const body = ListProjectsResponseSchema.parse(await (await GET()).json());
    expect(body.projects[0]?.messagesLimit).toBe(PLAN_LIMITS.pro.messagesPerMonth);
  });

  it("500 with a generic message when the read fails", async () => {
    ownerResult = { data: null, error: { message: "secret db detail" } };
    const res = await GET();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret db detail");
  });

  it("500 when the plan can't be read", async () => {
    getOwnerPlan.mockResolvedValue({ status: "error" });
    expect((await GET()).status).toBe(500);
  });
});

describe("POST /api/projects", () => {
  it("201: ensures the account, reads the plan, calls create_project with the plan's limit", async () => {
    const res = await post({ name: "Site" });
    expect(res.status).toBe(201);
    const body = CreateProjectResponseSchema.parse(await res.json());
    expect(body.project.id).toBe(ROW.id);
    expect(ensureAccount).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("create_project", {
      p_owner_id: "user_1",
      p_name: "Site",
      p_max_projects: PLAN_LIMITS.free.projects,
    });
  });

  it("the plan comes from the database, never the request body", async () => {
    await post({ name: "Site", plan: "pro", maxProjects: 999, p_max_projects: 999, ownerId: "user_2" });
    expect(rpc).toHaveBeenCalledWith("create_project", {
      p_owner_id: "user_1",
      p_name: "Site",
      p_max_projects: PLAN_LIMITS.free.projects,
    });
    getOwnerPlan.mockResolvedValue({ status: "ok", plan: "pro" });
    rpc.mockClear();
    await post({ name: "Site" });
    expect(rpc).toHaveBeenCalledWith("create_project", expect.objectContaining({ p_max_projects: PLAN_LIMITS.pro.projects }));
  });

  it("400: missing, empty, too long or non-JSON input, without touching the database", async () => {
    for (const body of [{}, { name: "" }, { name: "   " }, { name: "x".repeat(101) }, { name: 5 }, "not json"]) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("validation_failed");
    }
    expect(rpc).not.toHaveBeenCalled();
    expect(ensureAccount).not.toHaveBeenCalled();
  });

  it("403 plan_limit_reached at the Free limit, with an upgrade hint", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "plan_limit_reached", code: "P0001" } });
    const res = await post({ name: "Second" });
    expect(res.status).toBe(403);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("plan_limit_reached");
    expect(body.error.message).toMatch(/upgrade/i);
  });

  it("500 for any other database error, hiding the detail", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "secret db detail", code: "XX000" } });
    const res = await post({ name: "Site" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret db detail");
  });

  it("does not call the service client when nobody is signed in", async () => {
    auth.mockResolvedValue({ userId: null });
    expect((await post({ name: "Site" })).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
});
