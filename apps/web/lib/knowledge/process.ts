import "server-only";
import { EMBEDDING_DIMENSIONS } from "@askwell/shared";
import { embedTexts } from "../ai";
import { createServiceClient } from "../supabase/service";
import { chunkText, MAX_CHUNKS_PER_SOURCE } from "./chunk";

/** Same signature as `embedTexts` in `lib/ai`: one vector per text, in order. */
export type EmbedFn = (texts: string[]) => Promise<number[][]>;

/** Texts per embedding call, and rows per insert (a 1536-number vector is ~15 KB of JSON). */
export const EMBED_BATCH_SIZE = 100;
export const INSERT_BATCH_SIZE = 50;

export type ProcessResult =
  | { status: "ready"; chunks: number; truncated: boolean }
  | { status: "failed"; reason: "no_text" | "embedding_failed" | "store_failed" };

class StageError extends Error {
  constructor(readonly reason: "embedding_failed" | "store_failed", cause: unknown) {
    super(reason, { cause });
  }
}

/**
 * Turns a source's text into searchable chunks: chunk → embed → store → mark `ready`.
 * Any failure deletes this source's partial chunks and marks it `failed` (the result says why).
 * Safe to re-run for the same source: it clears the source's old chunks first.
 *
 * SERVER ONLY, and it uses the service client: the caller (the knowledge routes) must have checked
 * that the signed-in owner owns `projectId` before calling. Every write is scoped to both
 * `projectId` and `sourceId`, and every chunk row carries the source's `project_id`
 * (the composite foreign key needs them to agree).
 * Throws only when the database can't even record the failure.
 */
export async function processSource(args: {
  projectId: string;
  sourceId: string;
  text: string;
  /** Defaults to `embedTexts` from `lib/ai`; tests inject a fake. */
  embed?: EmbedFn;
}): Promise<ProcessResult> {
  const { projectId, sourceId, text, embed = embedTexts } = args;
  const db = createServiceClient();

  const clearChunks = async () => {
    const { error } = await db.from("knowledge_chunks").delete().eq("source_id", sourceId).eq("project_id", projectId);
    if (error) throw new Error(`clear chunks: ${error.message}`);
  };
  const setStatus = async (status: "ready" | "failed") => {
    const { error } = await db
      .from("knowledge_sources")
      .update({ status })
      .eq("id", sourceId)
      .eq("project_id", projectId);
    if (error) throw new Error(`set ${status}: ${error.message}`);
  };
  const fail = async (reason: Extract<ProcessResult, { status: "failed" }>["reason"]): Promise<ProcessResult> => {
    await clearChunks();
    await setStatus("failed");
    return { status: "failed", reason };
  };

  const { chunks, truncated } = chunkText(text, { maxChunks: MAX_CHUNKS_PER_SOURCE });
  if (chunks.length === 0) return fail("no_text");

  try {
    await clearChunks(); // idempotent re-run
    const vectors: number[][] = [];
    try {
      for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
        const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
        const result = await embed(batch);
        if (result.length !== batch.length || result.some((v) => v.length !== EMBEDDING_DIMENSIONS)) {
          throw new Error("embedding result has the wrong shape");
        }
        vectors.push(...result);
      }
    } catch (error) {
      throw new StageError("embedding_failed", error);
    }
    try {
      for (let i = 0; i < chunks.length; i += INSERT_BATCH_SIZE) {
        const rows = chunks.slice(i, i + INSERT_BATCH_SIZE).map((content, j) => ({
          project_id: projectId,
          source_id: sourceId,
          content,
          embedding: JSON.stringify(vectors[i + j]),
        }));
        const { error } = await db.from("knowledge_chunks").insert(rows);
        if (error) throw new Error(error.message);
      }
      await setStatus("ready");
    } catch (error) {
      throw new StageError("store_failed", error);
    }
    return { status: "ready", chunks: chunks.length, truncated };
  } catch (error) {
    return fail(error instanceof StageError ? error.reason : "store_failed");
  }
}
