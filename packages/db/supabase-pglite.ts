/**
 * Test-only helper: a PGlite instance that imitates the parts of Supabase our
 * migrations, RLS policies and functions depend on. Never import this from app code.
 *
 * Stubbed: roles (anon / authenticated / service_role), Supabase's default grants on
 * schema `public`, schema `auth` (jwt(), uid(), role()), schema `extensions` with
 * pgvector. Not stubbed: Storage, Realtime, PostgREST itself.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite, type Results } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";

export type SupabaseRole = "anon" | "authenticated" | "service_role";
export type SqlParams = unknown[];
export type Claims = Record<string, unknown>;

export const DEFAULT_MIGRATIONS_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../supabase/migrations",
);

const MIGRATION_FILE = /^\d{14}_[A-Za-z0-9_]+\.sql$/;

const SUPABASE_STUBS = /* sql */ `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema extensions;
create extension vector with schema extensions;
alter database postgres set search_path = "$user", public, extensions;
set search_path = "$user", public, extensions;

create schema auth;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

grant usage on schema public, extensions, auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;

-- Supabase's defaults: everything the postgres role creates in public is open to the
-- API roles. RLS and explicit REVOKEs in migrations are the only boundary.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

export type CreateOptions = {
  /** Directory of `<UTC timestamp>_<name>.sql` files. Defaults to `supabase/migrations`. */
  migrationsDir?: string;
};

/** Create a fresh in-memory database and apply every migration in name order. */
export async function createSupabasePglite(options: CreateOptions = {}): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { vector } });
  await db.exec(SUPABASE_STUBS);
  await applyMigrations(db, options.migrationsDir ?? DEFAULT_MIGRATIONS_DIR);
  return db;
}

export async function applyMigrations(db: PGlite, dir: string): Promise<string[]> {
  const files = readdirSync(dir)
    .filter((f) => f !== ".gitkeep")
    .sort();
  const bad = files.filter((f) => !MIGRATION_FILE.test(f));
  if (bad.length > 0) {
    throw new Error(`Bad migration file name (want <14-digit UTC timestamp>_<name>.sql): ${bad.join(", ")}`);
  }
  for (const file of files) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }
  return files;
}

/** Run one statement as `role`, with `claims` as the request's JWT claims. */
export function asRole<T = Record<string, unknown>>(
  db: PGlite,
  role: SupabaseRole,
  claims: Claims,
  sql: string,
  params?: SqlParams,
): Promise<Results<T>> {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ role, ...claims }),
    ]);
    await tx.exec(`set local role ${role}`);
    return tx.query<T>(sql, params);
  });
}

export function asUser<T = Record<string, unknown>>(
  db: PGlite,
  userId: string,
  sql: string,
  params?: SqlParams,
  extraClaims: Claims = {},
): Promise<Results<T>> {
  return asRole<T>(db, "authenticated", { ...extraClaims, sub: userId }, sql, params);
}

export function asAnon<T = Record<string, unknown>>(
  db: PGlite,
  sql: string,
  params?: SqlParams,
): Promise<Results<T>> {
  return asRole<T>(db, "anon", {}, sql, params);
}

export function asService<T = Record<string, unknown>>(
  db: PGlite,
  sql: string,
  params?: SqlParams,
): Promise<Results<T>> {
  return asRole<T>(db, "service_role", {}, sql, params);
}
