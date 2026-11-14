import "server-only";
import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import type { Plan } from "@askwell/shared";
import { createOwnerClient } from "./supabase/owner";
import { createServiceClient } from "./supabase/service";
import { signedUp } from "./analytics";
import { trackServer } from "./analytics/server";

/**
 * Makes sure the signed-in owner has an `accounts` row.
 *
 * The user id comes from the Clerk session on the server, never from the client.
 * Owners cannot insert into `accounts` (RLS), so this is a service-client write, and it
 * only runs after the session is verified. Insert on conflict do nothing: it never sends
 * or overwrites `plan` (the column default gives `free`; only the Clerk webhook changes it).
 * Fires `signed_up` once, when this call actually created the row (the conflict case returns no row).
 * Throws when nobody is signed in or the insert fails.
 *
 * Request-scoped (React `cache`): the layout and the page render in parallel, so every caller in
 * one request shares one insert. `getOwnerPlan` awaits it before reading, so the plan is never
 * read before the row exists.
 */
export const ensureAccount = cache(async (): Promise<void> => {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("ensureAccount: no signed-in owner (Clerk session missing)");
  }
  const { data, error } = await createServiceClient()
    .from("accounts")
    .upsert({ clerk_user_id: userId }, { onConflict: "clerk_user_id", ignoreDuplicates: true })
    .select("clerk_user_id");
  if (error) {
    throw new Error(`ensureAccount: could not create the account row (${error.message})`);
  }
  if (data && data.length > 0) trackServer("signed_up", userId, signedUp());
});

export type PlanState = { status: "ok"; plan: Plan } | { status: "error" };

/**
 * Reads the owner's plan through the owner client, so RLS scopes it to their own row.
 * Makes sure the row exists first (shared with the layout's call), so a new user's first load
 * doesn't read before the insert finishes. A missing row after that is still an error, never a
 * guessed Free. Never throws: a failed read becomes an error state for the UI.
 */
export async function getOwnerPlan(): Promise<PlanState> {
  try {
    await ensureAccount();
    const { data, error } = await (await createOwnerClient()).from("accounts").select("plan").maybeSingle();
    if (error || !data) return { status: "error" };
    return { status: "ok", plan: data.plan === "pro" ? "pro" : "free" };
  } catch {
    return { status: "error" };
  }
}
