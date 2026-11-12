import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErrorSchema, UpdateProjectResponseSchema } from "@askwell/shared";
import { fakeQuery, type QueryResult } from "../../../../lib/projects/test-helpers";

vi.mock("server-only", () => ({}));

const getOwnerPlan = vi.fn();
vi.mock("../../../../lib/accounts", () => ({ getOwnerPlan: () => getOwnerPlan() }));

let ownerResult: QueryResult = { data: null, error: null };
let last: ReturnType<typeof fakeQuery>;
const ownerFrom = vi.fn(() => {
  last = fakeQuery(ownerResult);
  return last.builder;
});
vi.mock("../../../../lib/supabase/owner", () => ({
  createOwnerClient: async () => ({ from: () => ownerFrom() }),
}));

const serviceFrom = vi.fn();
vi.mock("../../../../lib/supabase/service", () => ({ createServiceClient: () => ({ from: serviceFrom }) }));

import { DELETE, PATCH } from "./route";

const ID = "11111111-1111-4111-8111-111111111111";
const ROW = {
  id: ID,
  owner_id: "user_1",
  name: "Renamed",
  public_key: "pk_abcdefghijklmnopqrstuvwx",
  messages_used: 0,
  period_start: "2026-11-01T00:00:00+00:00",
  created_at: "2026-11-12T10:00:00+00:00",
};
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const patch = (id: string, body: unknown) =>
  PATCH(new Request(`http://localhost/api/projects/${id}`, { method: "PATCH", body: typeof body === "string" ? body : JSON.stringify(body) }), ctx(id));
const del = (id: string) => DELETE(new Request(`http://localhost/api/projects/${id}`, { method: "DELETE" }), ctx(id));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  getOwnerPlan.mockReset().mockResolvedValue({ status: "ok", plan: "free" });
  ownerResult = { data: ROW, error: null };
  ownerFrom.mockClear();
  serviceFrom.mockReset();
});

describe("PATCH /api/projects/:id", () => {
  it("200: renames through the owner client, updating only `name`", async () => {
    const res = await patch(ID, { name: "Renamed", ownerId: "user_2", public_key: "pk_x" });
    expect(res.status).toBe(200);
    expect(UpdateProjectResponseSchema.parse(await res.json()).project.name).toBe("Renamed");
    expect(ownerFrom).toHaveBeenCalled();
    expect(last.calls.update).toEqual([[{ name: "Renamed" }]]);
    expect(last.calls.eq).toEqual([["id", ID]]);
    expect(serviceFrom).not.toHaveBeenCalled();
  });

  it("404 when no row matches (missing or another owner's id)", async () => {
    ownerResult = { data: null, error: null };
    const res = await patch(ID, { name: "Renamed" });
    expect(res.status).toBe(404);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("not_found");
  });

  it("400: bad id, bad name or non-JSON body, without touching the database", async () => {
    for (const [id, body] of [["not-a-uuid", { name: "x" }], [ID, {}], [ID, { name: "" }], [ID, { name: "x".repeat(101) }], [ID, "nope"]] as const) {
      const res = await patch(id, body);
      expect(res.status).toBe(400);
      expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("validation_failed");
    }
    expect(ownerFrom).not.toHaveBeenCalled();
  });

  it("500 with a generic message on a database error", async () => {
    ownerResult = { data: null, error: { message: "secret db detail" } };
    const res = await patch(ID, { name: "Renamed" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret db detail");
  });
});

describe("DELETE /api/projects/:id", () => {
  it("200 { ok: true }: deletes through the owner client", async () => {
    ownerResult = { data: { id: ID }, error: null };
    const res = await del(ID);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(last.calls.delete).toHaveLength(1);
    expect(last.calls.eq).toEqual([["id", ID]]);
    expect(serviceFrom).not.toHaveBeenCalled();
  });

  it("404 when no row was deleted (missing or another owner's id)", async () => {
    ownerResult = { data: null, error: null };
    const res = await del(ID);
    expect(res.status).toBe(404);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("not_found");
  });

  it("400 for a malformed id, without touching the database", async () => {
    expect((await del("nope")).status).toBe(400);
    expect(ownerFrom).not.toHaveBeenCalled();
  });

  it("500 with a generic message on a database error", async () => {
    ownerResult = { data: null, error: { message: "secret db detail" } };
    const res = await del(ID);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret db detail");
  });
});
