import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@askwell/db";
import { getPublicSupabaseEnv, requireServerSecret } from "./env";

/**
 * RULE: this client acts as `service_role` and skips RLS.
 * - Use it only AFTER the route has checked ownership (and the plan) on the server.
 * - Never use it for owner reads: those go through `createOwnerClient()` so RLS applies.
 * - This is the only file that reads the Supabase secret key (see service.test.ts).
 */
export type ServiceClient = SupabaseClient<Database>;

export function createServiceClient(): ServiceClient {
  const { url } = getPublicSupabaseEnv();
  const secretKey = requireServerSecret("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY);
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
