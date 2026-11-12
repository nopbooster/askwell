import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErrorSchema } from "@askwell/shared";
import { fakeQuery, type QueryResult } from "../../../../lib/projects/test-helpers";

vi.mock("server-only", () => ({}));

let ownerResult: QueryResult = { data: null, error: null };
let last: ReturnType<typeof fakeQuery>;
vi.mock("../../../../lib/supabase/owner", () => ({
  createOwnerClient: async () => ({
    from: () => {
      last = fakeQuery(ownerResult);
      return last.builder;
    },
  }),
}));

const remove = vi.fn();
const sourcesDelete = vi.fn();
const serviceCreated = vi.fn();
vi.mock("../../../../lib/supabase/service", () => ({
  createServiceClient: () => {
    serviceCreated();
    return {
      storage: { from: () => ({ remove }) },
      from: () => ({ delete: () => ({ eq: (...a1: unknown[]) => ({ eq: (...a2: unknown[]) => sourcesDelete(a1, a2) }) }) }),
    };
  },
}));

import { DELETE } from "./route";

const ID = "22222222-2222-4222-8222-222222222222";
const PROJECT = "11111111-1111-4111-8111-111111111111";
const KEY = `${PROJECT}/33333333-3333-4333-8333-333333333333.pdf`;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const del = (id: string) => DELETE(new Request(`http://localhost/api/knowledge/${id}`, { method: "DELETE" }), ctx(id));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  ownerResult = { data: { id: ID, project_id: PROJECT, storage_key: KEY }, error: null };
  remove.mockReset().mockResolvedValue({ data: [], error: null });
  sourcesDelete.mockReset().mockResolvedValue({ error: null });
  serviceCreated.mockClear();
  last = undefined as unknown as typeof last;
});

describe("DELETE /api/knowledge/:id", () => {
  it("200: loads the source through the owner client, deletes its file, then the source", async () => {
    const res = await del(ID);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(last.calls.eq).toEqual([["id", ID]]);
    expect(remove).toHaveBeenCalledWith([KEY]);
    expect(sourcesDelete).toHaveBeenCalledWith(["id", ID], ["project_id", PROJECT]);
  });

  it("200 for a pasted text source: no Storage call", async () => {
    ownerResult = { data: { id: ID, project_id: PROJECT, storage_key: null }, error: null };
    expect((await del(ID)).status).toBe(200);
    expect(remove).not.toHaveBeenCalled();
    expect(sourcesDelete).toHaveBeenCalled();
  });

  it("404 for a source RLS hides (another owner's): the service client is never created", async () => {
    ownerResult = { data: null, error: null };
    const res = await del(ID);
    expect(res.status).toBe(404);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("not_found");
    expect(serviceCreated).not.toHaveBeenCalled();
  });

  it("400 for a malformed id, without touching the database", async () => {
    expect((await del("nope")).status).toBe(400);
    expect(last).toBeUndefined();
  });

  it("500 and keeps the source when the file can't be removed, so a retry can finish", async () => {
    remove.mockResolvedValue({ data: null, error: { message: "secret storage detail" } });
    const res = await del(ID);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret storage detail");
    expect(sourcesDelete).not.toHaveBeenCalled();
  });

  it("500 (generic) on a database error", async () => {
    ownerResult = { data: null, error: { message: "secret db detail" } };
    const res = await del(ID);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret db detail");
  });
});
