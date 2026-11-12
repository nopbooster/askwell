import { auth } from "@clerk/nextjs/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@askwell/db";
import { getPublicSupabaseEnv } from "./env";

export type OwnerClient = SupabaseClient<Database>;

/**
 * Supabase client acting as the signed-in owner. It sends the owner's Clerk session token,
 * so Postgres RLS scopes every query to their own rows. Use it for every owner read.
 * Throws if nobody is signed in. Server-side only (route handlers, server components, actions).
 */
export async function createOwnerClient(): Promise<OwnerClient> {
  const session = await auth();
  if (!session.userId) {
    throw new Error("createOwnerClient: no signed-in owner (Clerk session missing)");
  }
  const { url, publishableKey } = getPublicSupabaseEnv();
  return createClient<Database>(url, publishableKey, {
    // Fetched per request, so a token that rotated mid-session is never stale.
    accessToken: async () => {
      const token = await session.getToken();
      if (!token) throw new Error("createOwnerClient: Clerk returned no session token");
      return token;
    },
  });
}
