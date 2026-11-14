import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErrorSchema, FinalizeKnowledgeResponseSchema, MAX_KNOWLEDGE_FILE_BYTES } from "@askwell/shared";

vi.mock("server-only", () => ({}));

const afterTasks: Array<() => unknown> = [];
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => void afterTasks.push(task),
}));

const getOwnedProject = vi.fn();
vi.mock("../../../../../../lib/projects", () => ({ getOwnedProject: (id: string) => getOwnedProject(id) }));

let existing: { data: unknown; error: { message: string } | null } = { data: null, error: null };
vi.mock("../../../../../../lib/supabase/owner", () => ({
  createOwnerClient: async () => ({
    from: () => {
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = () => b;
      b.maybeSingle = async () => existing;
      return b;
    },
  }),
}));

const rpc = vi.fn();
const download = vi.fn();
const remove = vi.fn();
const sourcesDelete = vi.fn();
vi.mock("../../../../../../lib/supabase/service", () => ({
  createServiceClient: () => ({
    rpc,
    storage: { from: () => ({ download, remove }) },
    from: () => ({ delete: () => ({ eq: (...a1: unknown[]) => ({ eq: (...a2: unknown[]) => sourcesDelete(a1, a2) }) }) }),
  }),
}));
const processFileSource = vi.fn();
vi.mock("../../../../../../lib/knowledge/background", () => ({
  processFileSource: (a: unknown) => processFileSource(a),
  processTextSource: vi.fn(),
}));

const trackServer = vi.fn();
vi.mock("../../../../../../lib/analytics/server", () => ({ trackServer: (...args: unknown[]) => trackServer(...args) }));

import { POST } from "./route";

const ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_ID = "22222222-2222-4222-8222-222222222222";
const KEY = `${ID}/33333333-3333-4333-8333-333333333333.pdf`;
const claimed = (type = "pdf", storage_key: string | null = KEY) => ({
  id: SOURCE_ID,
  project_id: ID,
  title: "Policy",
  type,
  storage_key,
  status: "processing",
  created_at: "2026-11-12T10:00:00+00:00",
});
const blobOf = (bytes: Uint8Array | string) => new Blob([bytes as BlobPart]);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const post = (id: string, body: unknown) =>
  POST(new Request(`http://localhost/api/projects/${id}/knowledge/finalize`, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }), ctx(id));
const errorCode = async (res: Response) => ApiErrorSchema.parse(await res.json()).error.code;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  afterTasks.length = 0;
  getOwnedProject.mockReset().mockResolvedValue({ id: ID, owner_id: "user_1" });
  trackServer.mockReset();
  existing = { data: null, error: null };
  rpc.mockReset().mockResolvedValue({ data: [claimed()], error: null });
  download.mockReset().mockResolvedValue({ data: blobOf("%PDF-1.4 hello"), error: null });
  remove.mockReset().mockResolvedValue({ data: [], error: null });
  sourcesDelete.mockReset().mockResolvedValue({ error: null });
  processFileSource.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/projects/:id/knowledge/finalize", () => {
  it("200: claims once, checks the bytes, answers `processing`, then processes the file in after()", async () => {
    const res = await post(ID, { sourceId: SOURCE_ID });
    expect(res.status).toBe(200);
    expect(FinalizeKnowledgeResponseSchema.parse(await res.json()).source).toMatchObject({ id: SOURCE_ID, status: "processing" });
    expect(rpc).toHaveBeenCalledWith("claim_knowledge_source", { p_source_id: SOURCE_ID, p_project_id: ID });
    expect(download).toHaveBeenCalledWith(KEY);
    expect(remove).not.toHaveBeenCalled();
    expect(processFileSource).not.toHaveBeenCalled(); // not before the response
    expect(afterTasks).toHaveLength(1);
    await afterTasks[0]?.();
    expect(processFileSource).toHaveBeenCalledWith(expect.objectContaining({ projectId: ID, sourceId: SOURCE_ID, type: "pdf" }));
  });

  it("fires knowledge_added for the owner once the file passes, with ids and type only", async () => {
    expect((await post(ID, { sourceId: SOURCE_ID })).status).toBe(200);
    expect(trackServer).toHaveBeenCalledTimes(1);
    expect(trackServer).toHaveBeenCalledWith("knowledge_added", "user_1", {
      project_id: ID,
      source_id: SOURCE_ID,
      source_type: "pdf",
    });
  });

  it("doesn't fire knowledge_added for a refused file or a repeat finalize", async () => {
    download.mockResolvedValue({ data: blobOf("not a pdf"), error: null });
    expect((await post(ID, { sourceId: SOURCE_ID })).status).toBe(400);
    rpc.mockResolvedValue({ data: [], error: null });
    existing = { data: { id: SOURCE_ID }, error: null };
    expect((await post(ID, { sourceId: SOURCE_ID })).status).toBe(409);
    expect(trackServer).not.toHaveBeenCalled();
  });

  it("accepts a TXT file without the PDF check", async () => {
    rpc.mockResolvedValue({ data: [claimed("txt", `${ID}/x.txt`)], error: null });
    download.mockResolvedValue({ data: blobOf("plain words"), error: null });
    expect((await post(ID, { sourceId: SOURCE_ID })).status).toBe(200);
  });

  it("claim-once: a second finalize gets 409 conflict and does no work", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    existing = { data: { id: SOURCE_ID }, error: null };
    const res = await post(ID, { sourceId: SOURCE_ID });
    expect(res.status).toBe(409);
    expect(await errorCode(res)).toBe("conflict");
    expect(download).not.toHaveBeenCalled();
    expect(afterTasks).toHaveLength(0);
  });

  it("404 for an unknown source id (or another project's)", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const res = await post(ID, { sourceId: SOURCE_ID });
    expect(res.status).toBe(404);
    expect(await errorCode(res)).toBe("not_found");
  });

  it("404 for another owner's project, before any service call", async () => {
    getOwnedProject.mockResolvedValue(null);
    const res = await post(ID, { sourceId: SOURCE_ID });
    expect(res.status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("400 unsupported_file_type for a fake PDF: the file and the source are deleted, nothing is processed", async () => {
    download.mockResolvedValue({ data: blobOf("just some text renamed to .pdf"), error: null });
    const res = await post(ID, { sourceId: SOURCE_ID });
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("unsupported_file_type");
    expect(remove).toHaveBeenCalledWith([KEY]);
    expect(sourcesDelete).toHaveBeenCalledWith(["id", SOURCE_ID], ["project_id", ID]);
    expect(afterTasks).toHaveLength(0);
  });

  it("400 file_too_large when the real size is over 10 MB: file and source deleted", async () => {
    download.mockResolvedValue({ data: { size: MAX_KNOWLEDGE_FILE_BYTES + 1, arrayBuffer: vi.fn() }, error: null });
    const res = await post(ID, { sourceId: SOURCE_ID });
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("file_too_large");
    expect(remove).toHaveBeenCalledWith([KEY]);
    expect(sourcesDelete).toHaveBeenCalled();
    expect(afterTasks).toHaveLength(0);
  });

  it("400 when nothing was uploaded: the reservation is cleaned up", async () => {
    download.mockResolvedValue({ data: null, error: { message: "Object not found" } });
    const res = await post(ID, { sourceId: SOURCE_ID });
    expect(res.status).toBe(400);
    expect(sourcesDelete).toHaveBeenCalled();
    expect(afterTasks).toHaveLength(0);
  });

  it("still answers 400 and deletes the source when removing the file fails", async () => {
    download.mockResolvedValue({ data: blobOf("not a pdf"), error: null });
    remove.mockResolvedValue({ data: null, error: { message: "storage down" } });
    expect((await post(ID, { sourceId: SOURCE_ID })).status).toBe(400);
    expect(sourcesDelete).toHaveBeenCalled();
  });

  it("400 validation_failed for a bad project id, a bad source id or a non-JSON body", async () => {
    for (const [id, body] of [["nope", { sourceId: SOURCE_ID }], [ID, { sourceId: "x" }], [ID, {}], [ID, "nope"]] as const) {
      const res = await post(id, body);
      expect(res.status).toBe(400);
      expect(await errorCode(res)).toBe("validation_failed");
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("500 (generic) on a database error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "secret db detail" } });
    const res = await post(ID, { sourceId: SOURCE_ID });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret db detail");
  });
});
