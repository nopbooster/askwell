import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  applyMigrations,
  asAnon,
  asService,
  asUser,
  createSupabasePglite,
} from "../supabase-pglite";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "__fixtures__/migrations");

let db: PGlite;
beforeAll(async () => {
  db = await createSupabasePglite({ migrationsDir: fixtures });
}, 60_000);
afterAll(async () => {
  await db.close();
});

describe("supabase-pglite", () => {
  it("applies migrations in name order (seed runs after the table exists)", async () => {
    const r = await asService<{ n: number }>(db, "select count(*)::int as n from public.notes");
    expect(r.rows[0]?.n).toBe(3);
  });

  it("rejects files that are not <timestamp>_<name>.sql", async () => {
    await expect(applyMigrations(db, join(here, "__fixtures__/bad"))).rejects.toThrow(
      /Bad migration file name/,
    );
  });

  it("loads pgvector", async () => {
    const r = await asService<{ id: number }>(
      db,
      "select id from public.notes order by embedding <-> '[0,0,1]' limit 1",
    );
    const body = await asService<{ body: string }>(
      db,
      "select body from public.notes where id = $1",
      [r.rows[0]?.id],
    );
    expect(body.rows[0]?.body).toBe("b1");
  });

  it("auth.jwt()->>'sub' returns the given user", async () => {
    const r = await asUser<{ sub: string; role: string }>(
      db,
      "user_123",
      "select auth.jwt() ->> 'sub' as sub, auth.role() as role",
    );
    expect(r.rows[0]).toEqual({ sub: "user_123", role: "authenticated" });
  });

  it("auth.uid() reads a uuid sub like Supabase", async () => {
    const id = "123e4567-e89b-42d3-a456-426614174000";
    const r = await asUser<{ uid: string }>(db, id, "select auth.uid() as uid");
    expect(r.rows[0]?.uid).toBe(id);
  });

  it("RLS hides another user's rows", async () => {
    const a = await asUser<{ body: string }>(db, "user_a", "select body from public.notes order by id");
    expect(a.rows.map((x) => x.body)).toEqual(["a1", "a2"]);
    const b = await asUser<{ body: string }>(db, "user_b", "select body from public.notes");
    expect(b.rows.map((x) => x.body)).toEqual(["b1"]);
    const nobody = await asUser(db, "user_c", "select * from public.notes");
    expect(nobody.rows).toHaveLength(0);
  });

  it("service_role bypasses RLS", async () => {
    const r = await asService(db, "select * from public.notes");
    expect(r.rows).toHaveLength(3);
  });

  it("anon has default grants, so RLS (no anon policy) is what hides rows", async () => {
    const r = await asAnon(db, "select * from public.notes");
    expect(r.rows).toHaveLength(0);
  });

  it("anon is denied when grants are revoked", async () => {
    await expect(asAnon(db, "select * from public.secrets")).rejects.toThrow(/permission denied/);
    const r = await asService(db, "select * from public.secrets");
    expect(r.rows).toHaveLength(1);
  });

  it("does not leak the role or claims after a call", async () => {
    await asUser(db, "user_a", "select 1");
    const r = await db.query<{ u: string }>("select current_user as u");
    expect(r.rows[0]?.u).toBe("postgres");
  });
});
