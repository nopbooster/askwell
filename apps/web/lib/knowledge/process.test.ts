import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = { knowledge_chunks: [], knowledge_sources: [] };
let failInsert: ((batchNo: number) => boolean) | undefined;
let insertCalls = 0;

/** A tiny in-memory supabase-js: from(t).insert / update(...).eq().eq() / delete().eq().eq(). */
function from(table: string) {
  const rows = () => tables[table] as Row[];
  const filtered = (filters: [string, unknown][]) => rows().filter((r) => filters.every(([k, v]) => r[k] === v));
  const chain = (run: (filters: [string, unknown][]) => { error: { message: string } | null }) => {
    const filters: [string, unknown][] = [];
    const b = {
      eq(k: string, v: unknown) {
        filters.push([k, v]);
        return b;
      },
      then: (resolve: (v: { error: { message: string } | null }) => unknown) => resolve(run(filters)),
    };
    return b;
  };
  return {
    insert: (newRows: Row[]) => {
      insertCalls += 1;
      if (failInsert?.(insertCalls)) return Promise.resolve({ error: { message: "insert failed" } });
      rows().push(...newRows.map((r) => ({ ...r })));
      return Promise.resolve({ error: null });
    },
    update: (patch: Row) =>
      chain((f) => {
        for (const r of filtered(f)) Object.assign(r, patch);
        return { error: null };
      }),
    delete: () =>
      chain((f) => {
        const drop = new Set(filtered(f));
        tables[table] = rows().filter((r) => !drop.has(r));
        return { error: null };
      }),
  };
}
vi.mock("../supabase/service", () => ({ createServiceClient: () => ({ from }) }));

import { EMBEDDING_DIMENSIONS } from "@askwell/shared";
import { processSource } from "./process";

const P = "00000000-0000-0000-0000-0000000000a1";
const S = "00000000-0000-0000-0000-0000000000a2";
const OTHER_S = "00000000-0000-0000-0000-0000000000b2";
const vec = (x: number) => Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => (i === 0 ? x : 0));
const fakeEmbed = vi.fn(async (texts: string[]) => texts.map((_, i) => vec(i + 1)));
const longText = "This is a sentence about refunds. ".repeat(400); // ~13.6k chars → several chunks

const chunks = (): Row[] => tables.knowledge_chunks ?? [];
const chunksOf = (source: string) => chunks().filter((r) => r.source_id === source);
const statusOf = (source: string) => tables.knowledge_sources?.find((r) => r.id === source)?.status;

beforeEach(() => {
  tables.knowledge_chunks = [];
  tables.knowledge_sources = [
    { id: S, project_id: P, status: "processing" },
    { id: OTHER_S, project_id: P, status: "ready" },
  ];
  failInsert = undefined;
  insertCalls = 0;
  fakeEmbed.mockReset();
  fakeEmbed.mockImplementation(async (texts) => texts.map((_, i) => vec(i + 1)));
});

describe("processSource", () => {
  it("chunks, embeds, stores and marks the source ready", async () => {
    const r = await processSource({ projectId: P, sourceId: S, text: longText, embed: fakeEmbed });
    expect(r.status).toBe("ready");
    const stored = chunksOf(S);
    expect(stored.length).toBeGreaterThan(2);
    expect(r).toMatchObject({ chunks: stored.length, truncated: false });
    expect(statusOf(S)).toBe("ready");
    expect(statusOf(OTHER_S)).toBe("ready");
  });

  it("every chunk carries the source's project_id and source_id, content and a 1536-d vector", async () => {
    await processSource({ projectId: P, sourceId: S, text: longText, embed: fakeEmbed });
    for (const row of chunksOf(S)) {
      expect(row.project_id).toBe(P);
      expect(row.source_id).toBe(S);
      expect(typeof row.content).toBe("string");
      expect(JSON.parse(row.embedding as string)).toHaveLength(EMBEDDING_DIMENSIONS);
    }
  });

  it("embeds in order: chunk i gets vector i of its batch", async () => {
    await processSource({ projectId: P, sourceId: S, text: longText, embed: fakeEmbed });
    const first = JSON.parse(chunksOf(S)[0]?.embedding as string) as number[];
    expect(first[0]).toBe(1);
  });

  it("batches embedding calls", async () => {
    const text = "word ".repeat(300_000); // hits the 400-chunk cap
    const r = await processSource({ projectId: P, sourceId: S, text, embed: fakeEmbed });
    expect(r).toMatchObject({ status: "ready", chunks: 400, truncated: true });
    expect(fakeEmbed).toHaveBeenCalledTimes(4);
    for (const [batch] of fakeEmbed.mock.calls) expect(batch.length).toBeLessThanOrEqual(100);
  });

  it("embedding failure → failed, no leftover chunks", async () => {
    fakeEmbed.mockRejectedValueOnce(new Error("openai down"));
    const r = await processSource({ projectId: P, sourceId: S, text: longText, embed: fakeEmbed });
    expect(r).toEqual({ status: "failed", reason: "embedding_failed" });
    expect(chunksOf(S)).toEqual([]);
    expect(statusOf(S)).toBe("failed");
  });

  it("a later embedding batch failing leaves nothing behind", async () => {
    fakeEmbed.mockImplementationOnce(async (t) => t.map(() => vec(1))).mockRejectedValueOnce(new Error("rate limited"));
    const r = await processSource({ projectId: P, sourceId: S, text: "word ".repeat(300_000), embed: fakeEmbed });
    expect(r).toEqual({ status: "failed", reason: "embedding_failed" });
    expect(chunksOf(S)).toEqual([]);
    expect(statusOf(S)).toBe("failed");
  });

  it("a wrong-shaped embedding result counts as an embedding failure", async () => {
    fakeEmbed.mockResolvedValueOnce([vec(1)]);
    const r = await processSource({ projectId: P, sourceId: S, text: longText, embed: fakeEmbed });
    expect(r).toEqual({ status: "failed", reason: "embedding_failed" });
    expect(chunksOf(S)).toEqual([]);
  });

  it("an insert failing midway deletes the partial chunks and fails the source", async () => {
    failInsert = (n) => n === 2;
    const text = "word ".repeat(300_000);
    const r = await processSource({ projectId: P, sourceId: S, text, embed: fakeEmbed });
    expect(r).toEqual({ status: "failed", reason: "store_failed" });
    expect(chunksOf(S)).toEqual([]);
    expect(statusOf(S)).toBe("failed");
  });

  it("text with no content → failed (no_text), nothing embedded", async () => {
    const r = await processSource({ projectId: P, sourceId: S, text: " \n ", embed: fakeEmbed });
    expect(r).toEqual({ status: "failed", reason: "no_text" });
    expect(fakeEmbed).not.toHaveBeenCalled();
    expect(statusOf(S)).toBe("failed");
  });

  it("is idempotent: a re-run replaces the source's chunks, not duplicates them", async () => {
    await processSource({ projectId: P, sourceId: S, text: longText, embed: fakeEmbed });
    const n = chunksOf(S).length;
    await processSource({ projectId: P, sourceId: S, text: longText, embed: fakeEmbed });
    expect(chunksOf(S)).toHaveLength(n);
    expect(statusOf(S)).toBe("ready");
  });

  it("a failed re-run of a ready source removes its old chunks too", async () => {
    await processSource({ projectId: P, sourceId: S, text: longText, embed: fakeEmbed });
    fakeEmbed.mockRejectedValueOnce(new Error("boom"));
    await processSource({ projectId: P, sourceId: S, text: longText, embed: fakeEmbed });
    expect(chunksOf(S)).toEqual([]);
    expect(statusOf(S)).toBe("failed");
  });

  it("never touches another source's chunks", async () => {
    chunks().push({ project_id: P, source_id: OTHER_S, content: "keep", embedding: "[]" });
    fakeEmbed.mockRejectedValueOnce(new Error("boom"));
    await processSource({ projectId: P, sourceId: S, text: longText, embed: fakeEmbed });
    expect(chunksOf(OTHER_S)).toHaveLength(1);
    expect(statusOf(OTHER_S)).toBe("ready");
  });
});
