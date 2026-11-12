import "server-only";
import { KNOWLEDGE_FILE_TYPES, type KnowledgeSourceType } from "@askwell/shared";
import type { ServiceClient } from "../supabase/service";

export const KNOWLEDGE_BUCKET = "knowledge";

export type KnowledgeFileKind = { type: Exclude<KnowledgeSourceType, "text">; ext: string };

/** The file kind for a file name, from its extension (case-insensitive). `null` when unsupported. */
export function knowledgeFileKind(fileName: string): KnowledgeFileKind | null {
  const name = fileName.toLowerCase();
  for (const [type, { extensions }] of Object.entries(KNOWLEDGE_FILE_TYPES)) {
    const ext = extensions.find((e) => name.endsWith(e));
    if (ext) return { type: type as KnowledgeFileKind["type"], ext };
  }
  return null;
}

/** Removes files from the private bucket. Missing keys are not an error. Throws on a Storage failure. */
export async function removeKnowledgeFiles(db: ServiceClient, keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const { error } = await db.storage.from(KNOWLEDGE_BUCKET).remove(keys);
  if (error) throw new Error(`remove knowledge files: ${error.message}`);
}

const LIST_PAGE = 100;
const MAX_PAGES = 100; // 10,000 files per project is far beyond any plan limit; stops a runaway loop

/**
 * Removes every file under `<projectId>/` in the bucket (used when a project is deleted).
 * Lists from the start each round, because removed files drop out of the listing.
 * Throws on a Storage failure, so the caller can stop before deleting the project.
 */
export async function removeProjectFiles(db: ServiceClient, projectId: string): Promise<void> {
  const bucket = db.storage.from(KNOWLEDGE_BUCKET);
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await bucket.list(projectId, { limit: LIST_PAGE });
    if (error) throw new Error(`list project files: ${error.message}`);
    if (!data || data.length === 0) return;
    await removeKnowledgeFiles(
      db,
      data.map((f) => `${projectId}/${f.name}`),
    );
  }
  throw new Error("remove project files: too many files");
}
