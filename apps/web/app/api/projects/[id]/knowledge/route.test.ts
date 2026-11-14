import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErrorSchema, AddKnowledgeTextResponseSchema, ListKnowledgeResponseSchema, PLAN_LIMITS } from "@askwell/shared";
import { fakeQuery, type QueryResult } from "../../../../../lib/projects/test-helpers";

vi.mock("server-only", () => ({}));

const afterTasks: Array<() => unknown> = [];
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => void afterTasks.push(task),
}));

const getOwnerPlan = vi.fn();
vi.mock("../../../../../lib/accounts", () => ({ getOwnerPlan: () => getOwnerPlan() }));
const getOwnedProject = vi.fn();
vi.mock("../../../../../lib/projects", () => ({ getOwnedProject: (id: string) => getOwnedProject(id) }));

let ownerResult: QueryResult = { data: [], error: null };
let last: ReturnType<typeof fakeQuery>;
vi.mock("../../../../../lib/supabase/owner", () => ({
  createOwnerClient: async () => ({
    from: () => {
      last = fakeQuery(ownerResult);
      return last.builder;
    },
  }),
}));

const rpc = vi.fn();
const remove = vi.fn();
vi.mock("../../../../../lib/supabase/service", () => ({
  createServiceClient: () => ({ rpc, storage: { from: () => ({ remove }) } }),
}));
const processTextSource = vi.fn();
vi.mock("../../../../../lib/knowledge/background", () => ({
  processTextSource: (a: unknown) => processTextSource(a),
  processFileSource: vi.fn(),
}));

const trackServer = vi.fn();
vi.mock("../../../../../lib/analytics/server", () => ({ trackServer: (...args: unknown[]) => trackServer(...args) }));

import { GET, POST } from "./route";

const ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_ID = "22222222-2222-4222-8222-222222222222";
const ROW = {
  id: SOURCE_ID,
  project_id: ID,
  title: "FAQ",
  type: "text",
  storage_key: null,
  status: "processing",
  created_at: "2026-11-12T10:00:00+00:00",
  reclaimed_keys: [] as string[],
};
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const post = (id: string, body: unknown) =>
  POST(new Request(`http://localhost/api/projects/${id}/knowledge`, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }), ctx(id));
const get = (id: string) => GET(new Request(`http://localhost/api/projects/${id}/knowledge`), ctx(id));
const errorCode = async (res: Response) => ApiErrorSchema.parse(await res.json()).error.code;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  afterTasks.length = 0;
  getOwnerPlan.mockReset().mockResolvedValue({ status: "ok", plan: "free" });
  getOwnedProject.mockReset().mockResolvedValue({ id: ID, owner_id: "user_1" });
  trackServer.mockReset();
  rpc.mockReset().mockResolvedValue({ data: [ROW], error: null });
  remove.mockReset().mockResolvedValue({ data: [], error: null });
  processTextSource.mockReset().mockResolvedValue(undefined);
  ownerResult = { data: [], error: null };
});

describe("POST /api/projects/:id/knowledge", () => {
  it("201: reserves a `processing` text source with the plan's limit, then processes in after()", async () => {
    const res = await post(ID, { title: "FAQ", text: "  Refunds take 5 days.  " });
    expect(res.status).toBe(201);
    const { source } = AddKnowledgeTextResponseSchema.parse(await res.json());
    expect(source).toMatchObject({ id: SOURCE_ID, title: "FAQ", type: "text", status: "processing" });
    expect(JSON.stringify(source)).not.toContain("storage_key");
    expect(rpc).toHaveBeenCalledWith("reserve_knowledge_source", {
      p_project_id: ID,
      p_title: "FAQ",
      p_type: "text",
      p_storage_key: null,
      p_status: "processing",
      p_max_sources: PLAN_LIMITS.free.knowledgeSources,
    });
    expect(processTextSource).not.toHaveBeenCalled(); // not before the response
    expect(afterTasks).toHaveLength(1);
    await afterTasks[0]?.();
    expect(processTextSource).toHaveBeenCalledWith({ projectId: ID, sourceId: SOURCE_ID, text: "Refunds take 5 days." });
  });

  it("uses the Pro limit for a Pro owner (plan read on the server)", async () => {
    getOwnerPlan.mockResolvedValue({ status: "ok", plan: "pro" });
    await post(ID, { title: "FAQ", text: "x", plan: "pro" });
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p_max_sources: PLAN_LIMITS.pro.knowledgeSources });
  });

  it("fires knowledge_added for the owner with ids and type only (no title or text)", async () => {
    const res = await post(ID, { title: "Secret title", text: "secret visitor-facing text" });
    expect(res.status).toBe(201);
    expect(trackServer).toHaveBeenCalledTimes(1);
    expect(trackServer).toHaveBeenCalledWith("knowledge_added", "user_1", {
      project_id: ID,
      source_id: ROW.id,
      source_type: "text",
    });
    expect(JSON.stringify(trackServer.mock.calls)).not.toMatch(/secret/i);
  });

  it("403 plan_limit_reached at the limit, and nothing is processed", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "plan_limit_reached" } });
    const res = await post(ID, { title: "FAQ", text: "x" });
    expect(res.status).toBe(403);
    expect(await errorCode(res)).toBe("plan_limit_reached");
    expect(afterTasks).toHaveLength(0);
  });

  it("removes the files of reclaimed reservations from Storage", async () => {
    rpc.mockResolvedValue({ data: [{ ...ROW, reclaimed_keys: [`${ID}/old.pdf`] }], error: null });
    await post(ID, { title: "FAQ", text: "x" });
    expect(remove).toHaveBeenCalledWith([`${ID}/old.pdf`]);
  });

  it("400: bad id, missing title, empty or too long text, non-JSON body; nothing is read or written", async () => {
    for (const [id, body] of [
      ["nope", { title: "a", text: "b" }],
      [ID, { text: "b" }],
      [ID, { title: "", text: "b" }],
      [ID, { title: "a", text: "   " }],
      [ID, { title: "a", text: "x".repeat(200_001) }],
      [ID, "nope"],
    ] as const) {
      const res = await post(id, body);
      expect(res.status).toBe(400);
      expect(await errorCode(res)).toBe("validation_failed");
    }
    expect(getOwnedProject).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("404 for a project that isn't the owner's, before any plan read or service call", async () => {
    getOwnedProject.mockResolvedValue(null);
    const res = await post(ID, { title: "FAQ", text: "x" });
    expect(res.status).toBe(404);
    expect(await errorCode(res)).toBe("not_found");
    expect(getOwnerPlan).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("500 (generic) when the plan can't be read, and 500 on a database error", async () => {
    getOwnerPlan.mockResolvedValue({ status: "error" });
    expect((await post(ID, { title: "a", text: "b" })).status).toBe(500);
    getOwnerPlan.mockResolvedValue({ status: "ok", plan: "free" });
    rpc.mockResolvedValue({ data: null, error: { message: "secret db detail" } });
    const res = await post(ID, { title: "a", text: "b" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret db detail");
  });
});

describe("GET /api/projects/:id/knowledge", () => {
  it("200: the sources newest first, through the owner client, without storage keys", async () => {
    ownerResult = { data: [{ ...ROW, status: "ready" }], error: null };
    const res = await get(ID);
    expect(res.status).toBe(200);
    const { sources } = ListKnowledgeResponseSchema.parse(await res.json());
    expect(sources).toHaveLength(1);
    expect(sources[0]).toEqual({ id: SOURCE_ID, title: "FAQ", type: "text", status: "ready", createdAt: ROW.created_at });
    expect(last.calls.eq).toEqual([["project_id", ID]]);
    expect(last.calls.order).toEqual([["created_at", { ascending: false }]]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("400 for a bad id; 404 for another owner's project", async () => {
    expect((await get("nope")).status).toBe(400);
    getOwnedProject.mockResolvedValue(null);
    const res = await get(ID);
    expect(res.status).toBe(404);
    expect(await errorCode(res)).toBe("not_found");
  });

  it("500 (generic) on a database error", async () => {
    ownerResult = { data: null, error: { message: "secret db detail" } };
    const res = await get(ID);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret db detail");
  });
});
