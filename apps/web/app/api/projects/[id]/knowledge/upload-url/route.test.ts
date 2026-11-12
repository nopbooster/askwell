import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErrorSchema, MAX_KNOWLEDGE_FILE_BYTES, PLAN_LIMITS, UploadUrlResponseSchema } from "@askwell/shared";

vi.mock("server-only", () => ({}));

const getOwnerPlan = vi.fn();
vi.mock("../../../../../../lib/accounts", () => ({ getOwnerPlan: () => getOwnerPlan() }));
const getOwnedProject = vi.fn();
vi.mock("../../../../../../lib/projects", () => ({ getOwnedProject: (id: string) => getOwnedProject(id) }));

const rpc = vi.fn();
const remove = vi.fn();
const createSignedUploadUrl = vi.fn();
const sourcesDelete = vi.fn();
vi.mock("../../../../../../lib/supabase/service", () => ({
  createServiceClient: () => ({
    rpc,
    storage: { from: (bucket: string) => ({ remove, createSignedUploadUrl: (k: string) => createSignedUploadUrl(bucket, k) }) },
    from: () => ({ delete: () => ({ eq: () => ({ eq: (...a: unknown[]) => sourcesDelete(...a) }) }) }),
  }),
}));

import { POST } from "./route";

const ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_ID = "22222222-2222-4222-8222-222222222222";
const row = (storageKey: string, type = "pdf") => ({
  id: SOURCE_ID,
  project_id: ID,
  title: "Policy",
  type,
  storage_key: storageKey,
  status: "uploading",
  created_at: "2026-11-12T10:00:00+00:00",
  reclaimed_keys: [] as string[],
});
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const post = (id: string, body: unknown) =>
  POST(new Request(`http://localhost/api/projects/${id}/knowledge/upload-url`, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }), ctx(id));
const valid = { title: "Policy", fileName: "policy.PDF", sizeBytes: 1234 };
const errorCode = async (res: Response) => ApiErrorSchema.parse(await res.json()).error.code;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  getOwnerPlan.mockReset().mockResolvedValue({ status: "ok", plan: "free" });
  getOwnedProject.mockReset().mockResolvedValue({ id: ID });
  rpc.mockReset().mockImplementation(async (_fn: string, args: { p_storage_key: string; p_type: string }) => ({
    data: [row(args.p_storage_key, args.p_type)],
    error: null,
  }));
  remove.mockReset().mockResolvedValue({ data: [], error: null });
  createSignedUploadUrl.mockReset().mockResolvedValue({ data: { signedUrl: "https://storage.example/upload?token=t", token: "t", path: "p" }, error: null });
  sourcesDelete.mockReset().mockResolvedValue({ error: null });
});

describe("POST /api/projects/:id/knowledge/upload-url", () => {
  it("201: reserves an `uploading` source under <projectId>/<uuid>.<ext> and returns a signed URL", async () => {
    const res = await post(ID, valid);
    expect(res.status).toBe(201);
    const body = UploadUrlResponseSchema.parse(await res.json());
    expect(body.uploadUrl).toBe("https://storage.example/upload?token=t");
    expect(body.source).toMatchObject({ id: SOURCE_ID, type: "pdf", status: "uploading" });
    const args = rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(args).toMatchObject({ p_project_id: ID, p_type: "pdf", p_status: "uploading", p_max_sources: PLAN_LIMITS.free.knowledgeSources });
    expect(args.p_storage_key).toMatch(new RegExp(`^${ID}/[0-9a-f-]{36}\\.pdf$`));
    expect(String(args.p_storage_key)).not.toContain("policy"); // never the browser's file name
    expect(createSignedUploadUrl).toHaveBeenCalledWith("knowledge", args.p_storage_key);
  });

  it("maps the file kinds: .md and .markdown → md, .txt → txt", async () => {
    for (const [fileName, type, ext] of [["a.md", "md", ".md"], ["a.markdown", "md", ".markdown"], ["a.txt", "txt", ".txt"]] as const) {
      rpc.mockClear();
      expect((await post(ID, { ...valid, fileName })).status).toBe(201);
      const args = rpc.mock.calls[0]?.[1] as { p_type: string; p_storage_key: string };
      expect(args.p_type).toBe(type);
      expect(args.p_storage_key.endsWith(ext)).toBe(true);
    }
  });

  it("400 file_too_large above 10 MB; the limit itself is allowed", async () => {
    const big = await post(ID, { ...valid, sizeBytes: MAX_KNOWLEDGE_FILE_BYTES + 1 });
    expect(big.status).toBe(400);
    expect(await errorCode(big)).toBe("file_too_large");
    expect((await post(ID, { ...valid, sizeBytes: MAX_KNOWLEDGE_FILE_BYTES })).status).toBe(201);
  });

  it("400 unsupported_file_type for other extensions", async () => {
    for (const fileName of ["run.exe", "notes.docx", "pdf", "a.pdf.exe"]) {
      const res = await post(ID, { ...valid, fileName });
      expect(res.status).toBe(400);
      expect(await errorCode(res)).toBe("unsupported_file_type");
    }
  });

  it("400 validation_failed: bad id, missing title, zero size, non-JSON; nothing is read or written", async () => {
    for (const [id, body] of [["nope", valid], [ID, { ...valid, title: "" }], [ID, { ...valid, sizeBytes: 0 }], [ID, "nope"]] as const) {
      const res = await post(id, body);
      expect(res.status).toBe(400);
      expect(await errorCode(res)).toBe("validation_failed");
    }
    expect(getOwnedProject).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("404 for another owner's project, before any service call", async () => {
    getOwnedProject.mockResolvedValue(null);
    const res = await post(ID, valid);
    expect(res.status).toBe(404);
    expect(await errorCode(res)).toBe("not_found");
    expect(rpc).not.toHaveBeenCalled();
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("403 plan_limit_reached at the limit (no URL is created)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "plan_limit_reached" } });
    const res = await post(ID, valid);
    expect(res.status).toBe(403);
    expect(await errorCode(res)).toBe("plan_limit_reached");
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("removes the files of reclaimed reservations from Storage", async () => {
    rpc.mockImplementation(async (_fn: string, args: { p_storage_key: string }) => ({
      data: [{ ...row(args.p_storage_key), reclaimed_keys: [`${ID}/stale.pdf`] }],
      error: null,
    }));
    await post(ID, valid);
    expect(remove).toHaveBeenCalledWith([`${ID}/stale.pdf`]);
  });

  it("500 and gives the slot back when the signed URL can't be created", async () => {
    createSignedUploadUrl.mockResolvedValue({ data: null, error: { message: "storage down" } });
    const res = await post(ID, valid);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("storage down");
    expect(sourcesDelete).toHaveBeenCalledWith("project_id", ID);
  });
});
