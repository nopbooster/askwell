import "server-only";
import type { Plan } from "@askwell/shared";
import { createServiceClient } from "../supabase/service";

/**
 * Sets an owner's plan. Service client: the webhook has no owner session, and the user id comes
 * from a payload whose signature was verified. Upsert, so a payment is never lost when the
 * owner's `accounts` row doesn't exist yet (`ensureAccount` only inserts and never touches `plan`).
 * Throws on a database error (the route answers 500 so Clerk retries).
 */
export async function setAccountPlan(userId: string, plan: Plan): Promise<void> {
  const { error } = await createServiceClient()
    .from("accounts")
    .upsert({ clerk_user_id: userId, plan }, { onConflict: "clerk_user_id" });
  if (error) throw new Error(`setAccountPlan: write failed (${error.message})`);
}
