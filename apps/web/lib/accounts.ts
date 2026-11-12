import "server-only";
import { auth } from "@clerk/nextjs/server";
import type { Plan } from "@askwell/shared";
import { createOwnerClient } from "./supabase/owner";
import { createServiceClient } from "./supabase/service";

/**
 * Makes sure the signed-in owner has an `accounts` row.
 *
 * The user id comes from the Clerk session on the server, never from the client.
 * Owners cannot insert into `accounts` (RLS), so this is a service-client write, and it
 * only runs after the session is verified. Insert on conflict do nothing: it never sends
 * or overwrites `plan` (the column default gives `free`; only the Clerk webhook changes it).
 * Throws when nobody is signed in or the insert fails.
 */
export async function ensureAccount(): Promise<void> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("ensureAccount: no signed-in owner (Clerk session missing)");
  }
  const { error } = await createServiceClient()
    .from("accounts")
    .upsert({ clerk_user_id: userId }, { onConflict: "clerk_user_id", ignoreDuplicates: true });
  if (error) {
    throw new Error(`ensureAccount: could not create the account row (${error.message})`);
  }
}

export type PlanState = { status: "ok"; plan: Plan } | { status: "error" };

/**
 * Reads the owner's plan through the owner client, so RLS scopes it to their own row.
 * Never throws: a failed read becomes an error state for the UI.
 */
export async function getOwnerPlan(): Promise<PlanState> {
  try {
    const { data, error } = await (await createOwnerClient()).from("accounts").select("plan").maybeSingle();
    if (error || !data) return { status: "error" };
    return { status: "ok", plan: data.plan === "pro" ? "pro" : "free" };
  } catch {
    return { status: "error" };
  }
}
