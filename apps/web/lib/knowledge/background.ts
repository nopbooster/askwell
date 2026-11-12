import "server-only";
import type { KnowledgeSourceType } from "@askwell/shared";
import { createServiceClient } from "../supabase/service";
import { extractText } from "./extract";
import { processSource } from "./process";

/** Marks a source `failed` (best effort: it logs instead of throwing, so a background task never crashes). */
async function markFailed(projectId: string, sourceId: string, cause: unknown): Promise<void> {
  console.error("[knowledge] processing failed", { sourceId }, cause);
  const { error } = await createServiceClient()
    .from("knowledge_sources")
    .update({ status: "failed" })
    .eq("id", sourceId)
    .eq("project_id", projectId);
  if (error) console.error("[knowledge] could not mark source failed", { sourceId }, error.message);
}

/**
 * Background work for a pasted text (run it in `after()`). Never throws.
 * SERVER ONLY: the route has already checked the owner owns `projectId`.
 */
export async function processTextSource(args: { projectId: string; sourceId: string; text: string }): Promise<void> {
  try {
    await processSource(args);
  } catch (error) {
    await markFailed(args.projectId, args.sourceId, error);
  }
}

/**
 * Background work for an uploaded file (run it in `after()`): extract text, then `processSource`.
 * A file with no text (e.g. a scanned PDF) or unreadable bytes makes the source `failed`. Never throws.
 * SERVER ONLY: the route has already checked ownership.
 */
export async function processFileSource(args: {
  projectId: string;
  sourceId: string;
  type: Exclude<KnowledgeSourceType, "text">;
  bytes: Uint8Array;
}): Promise<void> {
  const { projectId, sourceId, type, bytes } = args;
  try {
    const text = await extractText(type, bytes);
    await processSource({ projectId, sourceId, text });
  } catch (error) {
    await markFailed(projectId, sourceId, error);
  }
}
