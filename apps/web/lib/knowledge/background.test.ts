import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const updates: { status: unknown; filters: [string, unknown][] }[] = [];
vi.mock("../supabase/service", () => ({
  createServiceClient: () => ({
    from: () => ({
      update: (patch: { status: unknown }) => {
        const entry = { status: patch.status, filters: [] as [string, unknown][] };
        updates.push(entry);
        const b = {
          eq(k: string, v: unknown) {
            entry.filters.push([k, v]);
            return b;
          },
          then: (resolve: (v: { error: null }) => unknown) => resolve({ error: null }),
        };
        return b;
      },
    }),
  }),
}));
const extractText = vi.fn();
vi.mock("./extract", () => ({ extractText: (...a: unknown[]) => extractText(...a) }));
const processSource = vi.fn();
vi.mock("./process", () => ({ processSource: (...a: unknown[]) => processSource(...a) }));

import { NoTextError } from "./errors";
import { processFileSource, processTextSource } from "./background";

const P = "00000000-0000-0000-0000-0000000000a1";
const S = "00000000-0000-0000-0000-0000000000a2";
const TEXT = "Brightwick internal pricing note: do not log me.";

beforeEach(() => {
  updates.length = 0;
  extractText.mockReset();
  processSource.mockReset().mockResolvedValue({ status: "ready", chunks: 1, truncated: false });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  return () => vi.mocked(console.error).mockRestore();
});

describe("background processing failure log", () => {
  it("a file with no text logs step extract, marks the source failed and doesn't process", async () => {
    extractText.mockRejectedValueOnce(new NoTextError());
    await processFileSource({ projectId: P, sourceId: S, type: "pdf", bytes: new Uint8Array([1]) });
    expect(console.error).toHaveBeenCalledWith("[knowledge] processing failed", {
      sourceId: S,
      step: "extract",
      error: { name: "NoTextError", message: "The file contains no extractable text." },
    });
    expect(processSource).not.toHaveBeenCalled();
    expect(updates).toEqual([{ status: "failed", filters: [["id", S], ["project_id", P]] }]);
  });

  it("a thrown processing error logs step process with name and message only, never the text", async () => {
    processSource.mockRejectedValueOnce(new Error("set failed: connection reset"));
    await processTextSource({ projectId: P, sourceId: S, text: TEXT });
    expect(console.error).toHaveBeenCalledWith("[knowledge] processing failed", {
      sourceId: S,
      step: "process",
      error: { name: "Error", message: "set failed: connection reset" },
    });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("Brightwick");
    expect(updates).toHaveLength(1);
  });

  it("a successful file run logs nothing", async () => {
    extractText.mockResolvedValueOnce(TEXT);
    await processFileSource({ projectId: P, sourceId: S, type: "md", bytes: new Uint8Array([1]) });
    expect(processSource).toHaveBeenCalledWith({ projectId: P, sourceId: S, text: TEXT });
    expect(console.error).not.toHaveBeenCalled();
  });
});
