import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { KNOWLEDGE_FILE_MIME_TYPES, MAX_KNOWLEDGE_FILE_BYTES } from "@askwell/shared";
import { asAnon, asService, asUser, createSupabasePglite } from "../supabase-pglite";

const P1 = "00000000-0000-0000-0000-0000000000a1";
const P2 = "00000000-0000-0000-0000-0000000000b1";
const MISSING = "00000000-0000-0000-0000-0000000000ff";
const vec = (x: number, y = 0) => `[${[x, y, ...Array<number>(1534).fill(0)].join(",")}]`;

let db: PGlite;
const s = <T = Record<string, unknown>>(sql: string, p?: unknown[]) => asService<T>(db, sql, p);

beforeAll(async () => {
  db = await createSupabasePglite();
}, 60_000);
afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await s("delete from accounts");
  await s("insert into accounts (clerk_user_id) values ('u1'), ('u2')");
  await s(
    `insert into projects (id, owner_id, name, public_key) values
     ($1, 'u1', 'one', 'pk_aaaaaaaaaaaaaaaaaaaa'), ($2, 'u2', 'two', 'pk_bbbbbbbbbbbbbbbbbbbb')`,
    [P1, P2],
  );
});

const reserve = (project: string, status = "uploading", key: string | null = "k/a.pdf", max = 3, type = "pdf") =>
  s<{ id: string; status: string; reclaimed_keys: string[] }>(
    "select * from public.reserve_knowledge_source($1, 'T', $2, $3, $4, $5)",
    [project, type, key, status, max],
  );

describe("storage bucket", () => {
  it("is private with the shared size and type limits", async () => {
    const r = await s<{ public: boolean; file_size_limit: string; allowed_mime_types: string[] }>(
      "select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'knowledge'",
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.public).toBe(false);
    expect(Number(r.rows[0]?.file_size_limit)).toBe(MAX_KNOWLEDGE_FILE_BYTES);
    expect([...(r.rows[0]?.allowed_mime_types ?? [])].sort()).toEqual([...KNOWLEDGE_FILE_MIME_TYPES].sort());
  });

  it("has no storage.objects policies, so anon and authenticated see nothing", async () => {
    const pol = await s("select 1 from pg_policies where schemaname = 'storage'");
    expect(pol.rows).toEqual([]);
    await s("insert into storage.objects (bucket_id, name) values ('knowledge', 'x')");
    expect((await asAnon(db, "select * from storage.objects")).rows).toEqual([]);
    expect((await asUser(db, "u1", "select * from storage.objects")).rows).toEqual([]);
    await expect(asAnon(db, "insert into storage.objects (bucket_id, name) values ('knowledge', 'y')")).rejects.toThrow();
  });
});

describe("reserve_knowledge_source", () => {
  it("inserts uploading (file) and processing (text) sources", async () => {
    const f = await reserve(P1);
    expect(f.rows[0]).toMatchObject({ status: "uploading", reclaimed_keys: [] });
    const t = await reserve(P1, "processing", null, 3, "text");
    expect(t.rows[0]?.status).toBe("processing");
  });

  it("counts every status, uploading included, and refuses at the limit", async () => {
    await reserve(P1);
    await reserve(P1, "processing", null, 3, "text");
    await s("insert into knowledge_sources (project_id, title, type, status) values ($1, 'f', 'text', 'failed')", [P1]);
    await expect(reserve(P1)).rejects.toThrow("plan_limit_reached");
    expect((await s<{ n: number }>("select count(*)::int n from knowledge_sources where project_id = $1", [P1])).rows[0]?.n).toBe(3);
    // another project is unaffected
    await reserve(P2);
  });

  it("reclaims uploading sources older than 2 hours and returns their keys", async () => {
    const old = await reserve(P1, "uploading", "old/1.pdf");
    const fresh = await reserve(P1, "uploading", "fresh/2.pdf");
    const oldP2 = await reserve(P2, "uploading", "other/3.pdf");
    await s("update knowledge_sources set created_at = now() - interval '3 hours' where id = $1 or id = $2", [
      old.rows[0]?.id,
      oldP2.rows[0]?.id,
    ]);
    await s(
      "insert into knowledge_sources (project_id, title, type, status, created_at) values ($1, 'p', 'text', 'processing', now() - interval '5 hours')",
      [P1],
    );
    const r = await reserve(P1, "uploading", "new/4.pdf");
    expect(r.rows[0]?.reclaimed_keys).toEqual(["old/1.pdf"]);
    const left = await s<{ id: string }>("select id from knowledge_sources where project_id = $1", [P1]);
    expect(left.rows.map((x) => x.id)).toContain(fresh.rows[0]?.id);
    expect(left.rows).toHaveLength(3); // fresh, old processing, new
    // other project's stale row untouched
    expect((await s("select 1 from knowledge_sources where id = $1", [oldP2.rows[0]?.id])).rows).toHaveLength(1);
  });

  it("a stale reservation frees room at the limit", async () => {
    const a = await reserve(P1, "uploading", "a", 1);
    await expect(reserve(P1, "uploading", "b", 1)).rejects.toThrow("plan_limit_reached");
    await s("update knowledge_sources set created_at = now() - interval '2 hours 1 minute' where id = $1", [a.rows[0]?.id]);
    const r = await reserve(P1, "uploading", "b", 1);
    expect(r.rows[0]?.reclaimed_keys).toEqual(["a"]);
  });

  it("rejects bad arguments and a missing project", async () => {
    await expect(reserve(P1, "ready")).rejects.toThrow("invalid_argument");
    await expect(reserve(P1, "uploading", null)).rejects.toThrow("invalid_argument");
    await expect(reserve(P1, "uploading", "k", -1)).rejects.toThrow("invalid_argument");
    await expect(reserve(MISSING)).rejects.toThrow("not_found");
  });

  it("concurrent reservations never exceed the limit", async () => {
    const results = await Promise.allSettled([1, 2, 3, 4, 5].map((i) => reserve(P1, "uploading", `k${i}`, 3)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect((await s<{ n: number }>("select count(*)::int n from knowledge_sources where project_id = $1", [P1])).rows[0]?.n).toBe(3);
  });
});

describe("claim_knowledge_source", () => {
  it("flips uploading to processing exactly once", async () => {
    const id = (await reserve(P1)).rows[0]?.id;
    const first = await s<{ status: string }>("select * from public.claim_knowledge_source($1, $2)", [id, P1]);
    expect(first.rows).toHaveLength(1);
    expect(first.rows[0]?.status).toBe("processing");
    const second = await s("select * from public.claim_knowledge_source($1, $2)", [id, P1]);
    expect(second.rows).toEqual([]);
  });

  it("returns nothing for another project's source or a missing id", async () => {
    const id = (await reserve(P1)).rows[0]?.id;
    expect((await s("select * from public.claim_knowledge_source($1, $2)", [id, P2])).rows).toEqual([]);
    expect((await s("select * from public.claim_knowledge_source($1, $2)", [MISSING, P1])).rows).toEqual([]);
    expect((await s<{ status: string }>("select status from knowledge_sources where id = $1", [id])).rows[0]?.status).toBe("uploading");
  });

  it("does not claim a source that isn't uploading", async () => {
    const id = (await reserve(P1, "processing", null, 3, "text")).rows[0]?.id;
    expect((await s("select * from public.claim_knowledge_source($1, $2)", [id, P1])).rows).toEqual([]);
  });

  it("only one of concurrent claims wins", async () => {
    const id = (await reserve(P1)).rows[0]?.id;
    const rs = await Promise.all(
      [1, 2, 3, 4].map(() => s("select * from public.claim_knowledge_source($1, $2)", [id, P1])),
    );
    expect(rs.filter((r) => r.rows.length === 1)).toHaveLength(1);
  });
});

describe("match_chunks", () => {
  async function source(project: string, status: string) {
    return (
      await s<{ id: string }>(
        "insert into knowledge_sources (project_id, title, type, status) values ($1, 't', 'text', $2) returning id",
        [project, status],
      )
    ).rows[0]?.id as string;
  }
  const chunk = (project: string, src: string, content: string, v: string) =>
    s("insert into knowledge_chunks (project_id, source_id, content, embedding) values ($1, $2, $3, $4)", [project, src, content, v]);
  const match = (project: string, v: string, k = 5) =>
    s<{ content: string; source_id: string; similarity: number }>(
      "select * from public.match_chunks($1, $2, $3)",
      [project, v, k],
    );

  it("returns the nearest chunks first with cosine similarity", async () => {
    const src = await source(P1, "ready");
    await chunk(P1, src, "near", vec(1, 0.1));
    await chunk(P1, src, "far", vec(0, 1));
    await chunk(P1, src, "mid", vec(1, 1));
    const r = await match(P1, vec(1, 0), 2);
    expect(r.rows.map((x) => x.content)).toEqual(["near", "mid"]);
    expect(r.rows[0]?.source_id).toBe(src);
    expect(r.rows[0]?.similarity).toBeGreaterThan(0.99);
    expect(r.rows[0]?.similarity).toBeGreaterThan(r.rows[1]?.similarity as number);
  });

  it("ignores other projects and non-ready sources", async () => {
    const ready = await source(P1, "ready");
    await chunk(P1, ready, "mine", vec(0, 1));
    for (const st of ["uploading", "processing", "failed"]) {
      await chunk(P1, await source(P1, st), `not-${st}`, vec(1, 0));
    }
    await chunk(P2, await source(P2, "ready"), "theirs", vec(1, 0));
    const r = await match(P1, vec(1, 0), 5);
    expect(r.rows.map((x) => x.content)).toEqual(["mine"]);
  });

  it("still finds a small project's chunks among many other tenants' nearer chunks", async () => {
    const other = await source(P2, "ready");
    for (let i = 0; i < 80; i++) await chunk(P2, other, `o${i}`, vec(1, i / 1000));
    const mine = await source(P1, "ready");
    await chunk(P1, mine, "m1", vec(0, 1));
    await chunk(P1, mine, "m2", vec(-1, 0));
    const r = await match(P1, vec(1, 0), 5);
    expect(r.rows.map((x) => x.content)).toEqual(["m1", "m2"]);
  });

  it("rejects a bad match count", async () => {
    await expect(match(P1, vec(1), 0)).rejects.toThrow("invalid_argument");
    await expect(match(P1, vec(1), 101)).rejects.toThrow("invalid_argument");
  });

  it("the cosine order is served by the HNSW index", async () => {
    // pgvector searches the HNSW index first and the project filter applies to its output (hence
    // iterative scan in the function). On a tiny table the planner may pick the exact project_id
    // btree + sort instead, so check the index is used for the ordering itself.
    const src = await source(P1, "ready");
    for (let i = 0; i < 50; i++) await chunk(P1, src, `c${i}`, vec(1, i / 50));
    await s("analyze knowledge_chunks");
    const plan = await db.transaction(async (tx) => {
      await tx.exec("set local enable_seqscan = off");
      const r = await tx.query<{ "QUERY PLAN": string }>(
        `explain select c.id from public.knowledge_chunks c
         order by c.embedding operator(extensions.<=>) '${vec(1)}' limit 5`,
      );
      return r.rows.map((x) => x["QUERY PLAN"]).join("\n");
    });
    expect(plan).toMatch(/Index Scan using knowledge_chunks_embedding_idx/);
  });
});

describe("consume_message", () => {
  const consume = (project: string, limit: number) =>
    s<{ allowed: boolean; messages_used: number }>("select * from public.consume_message($1, $2)", [project, limit]);

  it("counts up to the limit, then refuses without counting", async () => {
    expect((await consume(P1, 2)).rows[0]).toEqual({ allowed: true, messages_used: 1 });
    expect((await consume(P1, 2)).rows[0]).toEqual({ allowed: true, messages_used: 2 });
    expect((await consume(P1, 2)).rows[0]).toEqual({ allowed: false, messages_used: 2 });
    expect((await s<{ messages_used: number }>("select messages_used from projects where id = $1", [P1])).rows[0]?.messages_used).toBe(2);
  });

  it("resets the count and moves period_start when a new UTC month began", async () => {
    await s("update projects set messages_used = 100, period_start = date_trunc('month', now() at time zone 'utc' - interval '1 month') at time zone 'utc' where id = $1", [P1]);
    expect((await consume(P1, 100)).rows[0]).toEqual({ allowed: true, messages_used: 1 });
    const p = await s<{ ok: boolean }>(
      "select period_start = date_trunc('month', now() at time zone 'utc') at time zone 'utc' as ok from projects where id = $1",
      [P1],
    );
    expect(p.rows[0]?.ok).toBe(true);
  });

  it("keeps the reset even when the limit is 0 (refused)", async () => {
    await s("update projects set messages_used = 5, period_start = now() - interval '40 days' where id = $1", [P1]);
    expect((await consume(P1, 0)).rows[0]).toEqual({ allowed: false, messages_used: 0 });
  });

  it("does not touch other projects", async () => {
    await consume(P1, 5);
    expect((await s<{ messages_used: number }>("select messages_used from projects where id = $1", [P2])).rows[0]?.messages_used).toBe(0);
  });

  it("concurrent calls never exceed the limit", async () => {
    const rs = await Promise.all(Array.from({ length: 12 }, () => consume(P1, 5)));
    expect(rs.filter((r) => r.rows[0]?.allowed)).toHaveLength(5);
    expect((await s<{ messages_used: number }>("select messages_used from projects where id = $1", [P1])).rows[0]?.messages_used).toBe(5);
  });

  it("rejects a bad limit and a missing project", async () => {
    await expect(consume(P1, -1)).rejects.toThrow("invalid_argument");
    await expect(consume(MISSING, 5)).rejects.toThrow("not_found");
  });
});

describe("save_chat_turn", () => {
  const save = (project: string, conv: string | null, visitor = "v1", msg = "hi", reply = "hello") =>
    s<{ save_chat_turn: string }>("select public.save_chat_turn($1, $2, $3, $4, $5)", [project, conv, visitor, msg, reply]);

  it("creates the conversation on the first turn and stores both messages in order", async () => {
    const id = (await save(P1, null)).rows[0]?.save_chat_turn as string;
    const c = await s<{ project_id: string; visitor_id: string }>("select * from conversations where id = $1", [id]);
    expect(c.rows[0]).toMatchObject({ project_id: P1, visitor_id: "v1" });
    const m = await s<{ role: string; body: string; later: boolean }>(
      `select role, body, created_at > lag(created_at) over (order by created_at) as later
       from messages where conversation_id = $1 order by created_at`,
      [id],
    );
    expect(m.rows.map((r) => [r.role, r.body])).toEqual([["visitor", "hi"], ["bot", "hello"]]);
    expect(m.rows[1]?.later).toBe(true);
  });

  it("appends to an existing conversation of the same project", async () => {
    const id = (await save(P1, null)).rows[0]?.save_chat_turn as string;
    const again = (await save(P1, id, "v1", "more", "sure")).rows[0]?.save_chat_turn;
    expect(again).toBe(id);
    expect((await s<{ n: number }>("select count(*)::int n from messages where conversation_id = $1", [id])).rows[0]?.n).toBe(4);
    expect((await s<{ n: number }>("select count(*)::int n from conversations")).rows[0]?.n).toBe(1);
  });

  it("rejects another project's conversation and writes nothing", async () => {
    const id = (await save(P1, null)).rows[0]?.save_chat_turn as string;
    await expect(save(P2, id)).rejects.toThrow("not_found");
    await expect(save(P1, MISSING)).rejects.toThrow("not_found");
    expect((await s<{ n: number }>("select count(*)::int n from messages")).rows[0]?.n).toBe(2);
  });

  it("rejects a missing project", async () => {
    await expect(save(MISSING, null)).rejects.toThrow("not_found");
  });
});

describe("EXECUTE permissions", () => {
  const CALLS = [
    ["reserve_knowledge_source", "select public.reserve_knowledge_source($1, 't', 'text', null, 'processing', 3)"],
    ["claim_knowledge_source", "select * from public.claim_knowledge_source($1, $1)"],
    ["match_chunks", `select * from public.match_chunks($1, '${vec(1)}', 5)`],
    ["consume_message", "select * from public.consume_message($1, 5)"],
    ["save_chat_turn", "select public.save_chat_turn($1, null, 'v', 'a', 'b')"],
  ] as const;

  for (const [name, sql] of CALLS) {
    it(`${name}: denied to anon and authenticated, allowed for service_role`, async () => {
      await expect(asAnon(db, sql, [P1])).rejects.toThrow(/permission denied/);
      await expect(asUser(db, "u1", sql, [P1])).rejects.toThrow(/permission denied/);
      await expect(s(sql, [P1])).resolves.toBeDefined();
    });
  }

  it("every new function is security invoker with an empty search_path", async () => {
    const r = await s<{ proname: string; prosecdef: boolean; proconfig: string[] }>(
      `select proname, prosecdef, proconfig from pg_proc
       where pronamespace = 'public'::regnamespace
         and proname in ('reserve_knowledge_source','claim_knowledge_source','match_chunks','consume_message','save_chat_turn')`,
    );
    expect(r.rows).toHaveLength(5);
    for (const f of r.rows) {
      expect(f.prosecdef, f.proname).toBe(false);
      expect(f.proconfig, f.proname).toContain('search_path=""');
    }
  });
});
