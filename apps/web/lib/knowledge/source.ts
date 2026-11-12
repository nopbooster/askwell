import type { Database } from "@askwell/db";
import type { KnowledgeSource, KnowledgeSourceStatus, KnowledgeSourceType } from "@askwell/shared";

export type KnowledgeSourceRow = Database["public"]["Tables"]["knowledge_sources"]["Row"];

/** DB row → shared `KnowledgeSource`. Never exposes the storage key. */
export function toKnowledgeSource(
  row: Pick<KnowledgeSourceRow, "id" | "title" | "type" | "status" | "created_at">,
): KnowledgeSource {
  return {
    id: row.id,
    title: row.title,
    type: row.type as KnowledgeSourceType,
    status: row.status as KnowledgeSourceStatus,
    createdAt: row.created_at,
  };
}
