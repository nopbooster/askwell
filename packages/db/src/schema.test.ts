import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  DEFAULT_WIDGET_CONFIG,
  KNOWLEDGE_SOURCE_STATUSES,
  KNOWLEDGE_SOURCE_TYPES,
  MESSAGE_ROLES,
  PLANS,
  WIDGET_ANIMATIONS,
  WIDGET_POSITIONS,
} from "@askwell/shared";
import { asAnon, asService, asUser, createSupabasePglite } from "../supabase-pglite";

const A = "user_A";
const B = "user_B";
const ID = {
  pa: "00000000-0000-0000-0000-0000000000a1",
  pb: "00000000-0000-0000-0000-0000000000b1",
  sa: "00000000-0000-0000-0000-0000000000a2",
  sb: "00000000-0000-0000-0000-0000000000b2",
  ca: "00000000-0000-0000-0000-0000000000a3",
  cb: "00000000-0000-0000-0000-0000000000b3",
};
const vec = (x: number) => `[${[x, ...Array<number>(1535).fill(0)].join(",")}]`;

const TABLES = [
  "accounts",
  "projects",
  "widget_configs",
  "knowledge_sources",
  "knowledge_chunks",
  "conversations",
  "messages",
] as const;

let db: PGlite;

async function seed() {
  const s = (sql: string, p?: unknown[]) => asService(db, sql, p);
  await s("insert into accounts (clerk_user_id) values ($1), ($2)", [A, B]);
  await s(
    `insert into projects (id, owner_id, name, public_key) values
     ($1, $3, 'A project', 'pk_aaaaaaaaaaaaaaaaaaaa'), ($2, $4, 'B project', 'pk_bbbbbbbbbbbbbbbbbbbb')`,
    [ID.pa, ID.pb, A, B],
  );
  await s("insert into widget_configs (project_id) values ($1), ($2)", [ID.pa, ID.pb]);
  await s(
    `insert into knowledge_sources (id, project_id, title, type, status) values
     ($1, $3, 'a', 'text', 'ready'), ($2, $4, 'b', 'text', 'ready')`,
    [ID.sa, ID.sb, ID.pa, ID.pb],
  );
  await s(
    `insert into knowledge_chunks (project_id, source_id, content, embedding) values
     ($1, $3, 'a', $5), ($2, $4, 'b', $6)`,
    [ID.pa, ID.pb, ID.sa, ID.sb, vec(1), vec(2)],
  );
  await s(
    `insert into conversations (id, project_id, visitor_id) values ($1, $3, 'v'), ($2, $4, 'v')`,
    [ID.ca, ID.cb, ID.pa, ID.pb],
  );
  await s(
    `insert into messages (conversation_id, role, body) values ($1, 'visitor', 'hi'), ($2, 'bot', 'yo')`,
    [ID.ca, ID.cb],
  );
}

beforeAll(async () => {
  db = await createSupabasePglite();
  await seed();
}, 60_000);
afterAll(async () => {
  await db.close();
});

const count = async (run: Promise<{ rows: { n: number }[] }>) => (await run).rows[0]?.n;

describe("migration", () => {
  it("applies from an empty database and creates exactly the seven tables", async () => {
    const r = await asService<{ table_name: string }>(
      db,
      "select table_name from information_schema.tables where table_schema = 'public' order by 1",
    );
    expect(r.rows.map((x) => x.table_name)).toEqual([...TABLES].sort());
  });

  it("enables RLS on every table", async () => {
    const r = await asService<{ relname: string; relrowsecurity: boolean }>(
      db,
      `select relname, relrowsecurity from pg_class
       where relnamespace = 'public'::regnamespace and relkind = 'r'`,
    );
    expect(r.rows).toHaveLength(TABLES.length);
    for (const row of r.rows) expect(row.relrowsecurity, row.relname).toBe(true);
  });

  it("has an index on every foreign key column", async () => {
    const r = await asService<{ conname: string }>(
      db,
      `select c.conname from pg_constraint c
       where c.contype = 'f' and c.connamespace = 'public'::regnamespace
         and not exists (
           select 1 from pg_index i
           where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])`,
    );
    expect(r.rows).toEqual([]);
  });

  it("has an HNSW cosine index on embeddings", async () => {
    const r = await asService<{ indexdef: string }>(
      db,
      "select indexdef from pg_indexes where indexname = 'knowledge_chunks_embedding_idx'",
    );
    expect(r.rows[0]?.indexdef).toMatch(/hnsw.*vector_cosine_ops/);
  });
});

describe("column defaults and checks", () => {
  it("widget_configs defaults equal DEFAULT_WIDGET_CONFIG", async () => {
    const r = await asService(db, "select * from widget_configs where project_id = $1", [ID.pa]);
    const row = r.rows[0] as Record<string, unknown>;
    expect({
      buttonColor: row.button_color,
      position: row.position,
      label: row.label,
      animation: row.animation,
      headerText: row.header_text,
      showBadge: row.show_badge,
    }).toEqual(DEFAULT_WIDGET_CONFIG);
  });

  it("accounts.plan defaults to free; projects counters default sensibly", async () => {
    const a = await asService<{ plan: string }>(db, "select plan from accounts where clerk_user_id = $1", [A]);
    expect(a.rows[0]?.plan).toBe("free");
    const p = await asService<{ messages_used: number; ok: boolean }>(
      db,
      `select messages_used,
              period_start = date_trunc('month', now() at time zone 'utc') at time zone 'utc' as ok
       from projects where id = $1`,
      [ID.pa],
    );
    expect(p.rows[0]).toEqual({ messages_used: 0, ok: true });
  });

  it("CHECK constraints accept exactly the @askwell/shared values", async () => {
    const accepts = async (sql: string, values: readonly string[], bad: string, params: (v: string) => unknown[]) => {
      for (const v of values) {
        await asService(db, sql, params(v)).catch((e: unknown) => {
          throw new Error(`rejected ${v}: ${String(e)}`);
        });
      }
      await expect(asService(db, sql, params(bad))).rejects.toThrow(/check constraint/);
    };
    // Each statement commits on its own, so rows persist: keys must be unique.
    let n = 0;
    await accepts(
      "insert into accounts (clerk_user_id, plan) values ($1, $2)",
      PLANS,
      "enterprise",
      (v) => [`plan_${v}_${n++}`, v],
    );
    await accepts(
      "update widget_configs set position = $1 where project_id = $2",
      WIDGET_POSITIONS,
      "middle",
      (v) => [v, ID.pa],
    );
    await accepts(
      "update widget_configs set animation = $1 where project_id = $2",
      WIDGET_ANIMATIONS,
      "spin",
      (v) => [v, ID.pa],
    );
    await accepts(
      "insert into knowledge_sources (project_id, title, type, status) values ($1, 't', $2, 'ready')",
      KNOWLEDGE_SOURCE_TYPES,
      "docx",
      (v) => [ID.pa, v],
    );
    await accepts(
      "insert into knowledge_sources (project_id, title, type, status) values ($1, 't', 'text', $2)",
      KNOWLEDGE_SOURCE_STATUSES,
      "done",
      (v) => [ID.pa, v],
    );
    await accepts(
      "insert into messages (conversation_id, role, body) values ($1, $2, 'x')",
      MESSAGE_ROLES,
      "system",
      (v) => [ID.ca, v],
    );
  });

  it("public_key is unique", async () => {
    await expect(
      asService(
        db,
        "insert into projects (owner_id, name, public_key) values ($1, 'dup', 'pk_aaaaaaaaaaaaaaaaaaaa')",
        [A],
      ),
    ).rejects.toThrow(/unique|duplicate/i);
  });
});

describe("tenant isolation (authenticated)", () => {
  it.each(TABLES)("user A sees only their own rows in %s", async (table) => {
    const total = await count(asService<{ n: number }>(db, `select count(*)::int as n from ${table}`));
    const own = await count(asUser<{ n: number }>(db, A, `select count(*)::int as n from ${table}`));
    expect(total).toBeGreaterThan(own as number);
    expect(own).toBeGreaterThan(0);
    // and none of B's
    const rows = await asUser(db, A, `select * from ${table}`);
    expect(JSON.stringify(rows.rows)).not.toContain(B);
    expect(JSON.stringify(rows.rows)).not.toContain(ID.pb);
    expect(JSON.stringify(rows.rows)).not.toContain(ID.cb);
  });

  it("a user with no account sees nothing", async () => {
    for (const table of TABLES) {
      expect(await count(asUser<{ n: number }>(db, "user_nobody", `select count(*)::int as n from ${table}`))).toBe(0);
    }
  });

  it.each(TABLES)("authenticated cannot INSERT into %s", async (table) => {
    await expect(asUser(db, A, `insert into ${table} select * from ${table} limit 1`)).rejects.toThrow(
      /permission denied/,
    );
  });

  it.each(TABLES.filter((t) => t !== "projects"))("authenticated cannot UPDATE or DELETE %s", async (table) => {
    const col = table === "accounts" ? "clerk_user_id" : table === "widget_configs" ? "project_id" : "id";
    await expect(asUser(db, A, `update ${table} set ${col} = ${col}`)).rejects.toThrow(/permission denied/);
    await expect(asUser(db, A, `delete from ${table}`)).rejects.toThrow(/permission denied/);
  });

  it("authenticated can update only projects.name", async () => {
    for (const col of ["owner_id", "public_key", "messages_used", "period_start", "created_at", "id"]) {
      await expect(asUser(db, A, `update projects set ${col} = ${col}`), col).rejects.toThrow(/permission denied/);
    }
    await expect(asUser(db, A, "insert into projects (owner_id, name, public_key) values ('x','x','x')")).rejects.toThrow(
      /permission denied/,
    );
  });

  it("owner can rename their own project but not another's", async () => {
    const own = await asUser(db, A, "update projects set name = 'Renamed' where id = $1", [ID.pa]);
    expect(own.affectedRows).toBe(1);
    const other = await asUser(db, A, "update projects set name = 'Hacked' where id = $1", [ID.pb]);
    expect(other.affectedRows).toBe(0);
    const r = await asService<{ name: string }>(db, "select name from projects where id = $1", [ID.pb]);
    expect(r.rows[0]?.name).toBe("B project");
  });

  it("owner cannot delete another's project", async () => {
    const other = await asUser(db, A, "delete from projects where id = $1", [ID.pb]);
    expect(other.affectedRows).toBe(0);
    expect(await count(asService<{ n: number }>(db, "select count(*)::int as n from projects where id = $1", [ID.pb]))).toBe(1);
  });
});

describe("anon", () => {
  it.each(TABLES)("has no access to %s", async (table) => {
    await expect(asAnon(db, `select * from ${table}`)).rejects.toThrow(/permission denied/);
    await expect(asAnon(db, `insert into ${table} select * from ${table} limit 1`)).rejects.toThrow(/permission denied/);
  });

  it("cannot call the RLS helpers", async () => {
    await expect(asAnon(db, "select * from public.owned_project_ids()")).rejects.toThrow(/permission denied/);
    await expect(asAnon(db, "select * from public.owned_conversation_ids()")).rejects.toThrow(/permission denied/);
  });
});

describe("RLS helpers", () => {
  it("are SECURITY DEFINER, STABLE, with an empty search_path", async () => {
    const r = await asService<{ proname: string; prosecdef: boolean; provolatile: string; proconfig: string[] }>(
      db,
      `select proname, prosecdef, provolatile, proconfig from pg_proc
       where pronamespace = 'public'::regnamespace order by proname`,
    );
    expect(r.rows.map((x) => x.proname)).toEqual(["owned_conversation_ids", "owned_project_ids"]);
    for (const f of r.rows) {
      expect(f.prosecdef).toBe(true);
      expect(f.provolatile).toBe("s");
      expect(f.proconfig).toContain('search_path=""');
    }
  });

  it("return only the caller's ids", async () => {
    const p = await asUser<{ id: string }>(db, A, "select * from public.owned_project_ids() as id");
    expect(p.rows.map((x) => Object.values(x)[0])).toEqual([ID.pa]);
    const c = await asUser<{ id: string }>(db, B, "select * from public.owned_conversation_ids() as id");
    expect(c.rows.map((x) => Object.values(x)[0])).toEqual([ID.cb]);
  });
});

describe("TRUNCATE", () => {
  it.each(TABLES)("is denied to every API role on %s", async (table) => {
    await expect(asUser(db, A, `truncate ${table} cascade`)).rejects.toThrow(/permission denied/);
    await expect(asAnon(db, `truncate ${table} cascade`)).rejects.toThrow(/permission denied/);
    await expect(asService(db, `truncate ${table} cascade`)).rejects.toThrow(/permission denied/);
  });
});

describe("service_role", () => {
  it.each(TABLES)("sees every row in %s", async (table) => {
    expect(await count(asService<{ n: number }>(db, `select count(*)::int as n from ${table}`))).toBeGreaterThanOrEqual(2);
  });
});

// Runs last: it deletes data.
describe("cascade deletes", () => {
  it("owner deleting a project removes its whole tree and nothing else", async () => {
    const del = await asUser(db, A, "delete from projects where id = $1", [ID.pa]);
    expect(del.affectedRows).toBe(1);
    for (const [table, col, val] of [
      ["widget_configs", "project_id", ID.pa],
      ["knowledge_sources", "project_id", ID.pa],
      ["knowledge_chunks", "project_id", ID.pa],
      ["conversations", "project_id", ID.pa],
    ] as const) {
      expect(
        await count(asService<{ n: number }>(db, `select count(*)::int as n from ${table} where ${col} = $1`, [val])),
        table,
      ).toBe(0);
    }
    expect(await count(asService<{ n: number }>(db, "select count(*)::int as n from messages where conversation_id = $1", [ID.ca]))).toBe(0);
    // B's data is untouched
    expect(await count(asService<{ n: number }>(db, "select count(*)::int as n from messages where conversation_id = $1", [ID.cb]))).toBe(1);
    expect(await count(asService<{ n: number }>(db, "select count(*)::int as n from knowledge_chunks where project_id = $1", [ID.pb]))).toBe(1);
  });

  it("deleting an account cascades to its projects", async () => {
    await asService(db, "delete from accounts where clerk_user_id = $1", [B]);
    expect(await count(asService<{ n: number }>(db, "select count(*)::int as n from projects"))).toBe(0);
  });
});
