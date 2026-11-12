import "server-only";
import { PLAN_LIMITS, type KnowledgeSourceType, type Plan } from "@askwell/shared";
import type { ServiceClient } from "../supabase/service";
import { removeKnowledgeFiles } from "./storage";
import type { KnowledgeSourceRow } from "./source";

export type ReserveResult =
  | { status: "reserved"; source: KnowledgeSourceRow }
  | { status: "limit_reached" };

/**
 * Reserves a source slot in Postgres (it locks the project, reclaims stale `uploading` rows, counts
 * every status, and refuses at the plan limit). Files from reclaimed reservations are removed from
 * Storage here (best effort: a failure is logged, the reservation is already gone).
 * SERVER ONLY: call it after `getOwnedProject` and the plan read. Throws on any other database error.
 */
export async function reserveKnowledgeSource(args: {
  db: ServiceClient;
  projectId: string;
  plan: Plan;
  title: string;
  type: KnowledgeSourceType;
  /** `null` for pasted text. */
  storageKey: string | null;
}): Promise<ReserveResult> {
  const { db, projectId, plan, title, type, storageKey } = args;
  const { data, error } = await db.rpc("reserve_knowledge_source", {
    p_project_id: projectId,
    p_title: title,
    p_type: type,
    // The generated type says `string`, but the function accepts null for pasted text.
    p_storage_key: storageKey as string,
    p_status: type === "text" ? "processing" : "uploading",
    p_max_sources: PLAN_LIMITS[plan].knowledgeSources,
  });
  if (error) {
    if (error.message === "plan_limit_reached") return { status: "limit_reached" };
    throw new Error(`reserve_knowledge_source: ${error.message}`);
  }
  const row = data?.[0];
  if (!row) throw new Error("reserve_knowledge_source: no row returned");

  const { reclaimed_keys: reclaimed, ...source } = row;
  try {
    await removeKnowledgeFiles(db, reclaimed ?? []);
  } catch (cleanupError) {
    console.error("[knowledge] could not remove reclaimed files", cleanupError);
  }
  return { status: "reserved", source };
}

export function limitMessage(plan: Plan): string {
  return plan === "free"
    ? `The Free plan includes ${PLAN_LIMITS.free.knowledgeSources} knowledge sources per project. Upgrade to Pro to add more.`
    : `You reached the limit of ${PLAN_LIMITS.pro.knowledgeSources} knowledge sources per project.`;
}
