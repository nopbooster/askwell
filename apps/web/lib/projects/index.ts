import "server-only";
import { PLAN_LIMITS, type Plan, type Project } from "@askwell/shared";
import type { Database } from "@askwell/db";
import { createOwnerClient } from "../supabase/owner";

export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];

/** DB row (snake_case) → shared `Project`. The message limit comes from the plan, never the client. */
export function toProject(row: ProjectRow, plan: Plan): Project {
  return {
    id: row.id,
    name: row.name,
    publicKey: row.public_key,
    messagesUsed: row.messages_used,
    messagesLimit: PLAN_LIMITS[plan].messagesPerMonth,
    periodStart: row.period_start,
    createdAt: row.created_at,
  };
}

/**
 * The signed-in owner's project, or `null` when it doesn't exist or isn't theirs.
 * Reads through the owner client, so RLS decides: another owner's id looks the same as a missing one.
 * Call this before any service-client write on `/api/projects/:id/...`. Throws on a database error.
 */
export async function getOwnedProject(id: string): Promise<ProjectRow | null> {
  const { data, error } = await (await createOwnerClient())
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getOwnedProject: read failed (${error.message})`);
  return data;
}
