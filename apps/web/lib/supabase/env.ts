import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string({ error: "NEXT_PUBLIC_SUPABASE_URL is missing" })
    .url("NEXT_PUBLIC_SUPABASE_URL must be a URL"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string({ error: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing" })
    .min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is empty"),
});

export type PublicSupabaseEnv = { url: string; publishableKey: string };

/** Parse the two public Supabase variables. Throws an error naming each bad variable. */
export function parsePublicSupabaseEnv(source: {
  NEXT_PUBLIC_SUPABASE_URL?: string | undefined;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string | undefined;
}): PublicSupabaseEnv {
  const result = publicSchema.safeParse(source);
  if (!result.success) {
    throw new Error(
      `Invalid Supabase environment: ${result.error.issues.map((i) => i.message).join("; ")}`,
    );
  }
  return {
    url: result.data.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: result.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

/** Read the public variables from `process.env` (literal accesses so Next can inline them). */
export function getPublicSupabaseEnv(): PublicSupabaseEnv {
  return parsePublicSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

/**
 * Validate a server secret that the caller read itself. The secret's own file reads it
 * from `process.env`; this module never does, so it stays out of every other file.
 */
export function requireServerSecret(name: string, value: string | undefined): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid Supabase environment: ${name} is missing`);
  }
  return value;
}
