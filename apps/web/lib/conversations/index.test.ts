import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatMessageSchema, ConversationSummarySchema } from "@askwell/shared";

vi.mock("server-only", () => ({}));

type Result = { data: unknown; error: { message: string } | null };

/** A fake supabase-js builder: records every call; awaiting it (or `maybeSingle`) resolves to `result`. */
function fakeQuery(result: Result) {
  const calls: Array<[string, unknown[]]> = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, args]);
      return builder;
    };
  }
  builder.maybeSingle = async () => result;
  builder.then = (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve);
  return { builder, calls };
}

const queries: Array<{ table: string; calls: Array<[string, unknown[]]> }> = [];
let results: Result[] = [];
const serviceClient = vi.fn();
vi.mock("../supabase/owner", () => ({
  createOwnerClient: async () => ({
    from: (table: string) => {
      const q = fakeQuery(results.shift() ?? { data: null, error: null });
      queries.push({ table, calls: q.calls });
      return q.builder;
    },
  }),
}));
vi.mock("../supabase/service", () => ({ createServiceClient: () => serviceClient() }));

import {
  CONVERSATION_LIST_LIMIT,
  PREVIEW_MAX_CHARS,
  getConversationThread,
  listProjectConversations,
  toConversationSummary,
  toPreview,
} from "./index";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const CONV = "22222222-2222-4222-8222-222222222222";
const listRow = (id: string, created_at: string, count: number, firstBody?: string) => ({
  id,
  visitor_id: `v-${id.slice(0, 4)}`,
  created_at,
  message_count: [{ count }],
  first_visitor: firstBody === undefined ? [] : [{ body: firstBody }],
});

beforeEach(() => {
  queries.length = 0;
  results = [];
  serviceClient.mockReset();
});

describe("toPreview", () => {
  it("keeps short text and collapses whitespace", () => {
    expect(toPreview("  Hi,\n\n  how   are you?  ")).toBe("Hi, how are you?");
  });
  it("cuts long text at PREVIEW_MAX_CHARS and adds an ellipsis", () => {
    const out = toPreview("a".repeat(PREVIEW_MAX_CHARS + 30));
    expect(out).toBe(`${"a".repeat(PREVIEW_MAX_CHARS)}…`);
  });
  it("does not cut text of exactly PREVIEW_MAX_CHARS", () => {
    expect(toPreview("b".repeat(PREVIEW_MAX_CHARS))).toBe("b".repeat(PREVIEW_MAX_CHARS));
  });
  it("never splits an emoji (counts characters, not UTF-16 units)", () => {
    const out = toPreview("😀".repeat(PREVIEW_MAX_CHARS + 1));
    expect(Array.from(out)).toHaveLength(PREVIEW_MAX_CHARS + 1); // + the ellipsis
    expect(out).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/); // no lone high surrogate
  });
  it("returns an empty string when there is no visitor message", () => {
    expect(toPreview(undefined)).toBe("");
    expect(toPreview(null)).toBe("");
  });
  it("keeps HTML as plain text (rendering escapes it)", () => {
    expect(toPreview("<b>hi</b>")).toBe("<b>hi</b>");
  });
});

describe("toConversationSummary", () => {
  it("maps a row to the shared shape", () => {
    const summary = toConversationSummary(listRow(CONV, "2026-11-12T10:00:00+00:00", 4, "Where is my order?"));
    expect(ConversationSummarySchema.parse(summary)).toEqual({
      id: CONV,
      visitorId: "v-2222",
      firstMessagePreview: "Where is my order?",
      messageCount: 4,
      createdAt: "2026-11-12T10:00:00+00:00",
    });
  });
  it("handles a conversation with no messages", () => {
    const row = { ...listRow(CONV, "2026-11-12T10:00:00+00:00", 0), message_count: [] };
    expect(toConversationSummary(row)).toMatchObject({ firstMessagePreview: "", messageCount: 0 });
  });
});

describe("listProjectConversations", () => {
  it("reads through the owner client: newest first, capped, count + first visitor message embedded", async () => {
    results = [{ data: [listRow(CONV, "2026-11-12T10:00:00+00:00", 2, "Hi")], error: null }];
    const out = await listProjectConversations(PROJECT);
    expect(out).toHaveLength(1);
    expect(serviceClient).not.toHaveBeenCalled();

    const [q] = queries;
    expect(q?.table).toBe("conversations");
    expect(q?.calls).toEqual([
      ["select", ["id, visitor_id, created_at, message_count:messages(count), first_visitor:messages(body)"]],
      ["eq", ["project_id", PROJECT]],
      ["eq", ["first_visitor.role", "visitor"]],
      ["order", ["created_at", { referencedTable: "first_visitor", ascending: true }]],
      ["limit", [1, { referencedTable: "first_visitor" }]],
      ["order", ["created_at", { ascending: false }]],
      ["order", ["id", { ascending: false }]],
      ["limit", [CONVERSATION_LIST_LIMIT]],
    ]);
  });
  it("keeps the database order (newest first)", async () => {
    results = [
      {
        data: [listRow("33333333-3333-4333-8333-333333333333", "2026-11-12T12:00:00+00:00", 2, "new"), listRow(CONV, "2026-11-12T10:00:00+00:00", 6, "old")],
        error: null,
      },
    ];
    expect((await listProjectConversations(PROJECT)).map((c) => c.firstMessagePreview)).toEqual(["new", "old"]);
  });
  it("throws on a database error", async () => {
    results = [{ data: null, error: { message: "boom" } }];
    await expect(listProjectConversations(PROJECT)).rejects.toThrow("boom");
  });
});

describe("getConversationThread", () => {
  const messages = [
    { id: "a1111111-1111-4111-8111-111111111111", role: "visitor", body: "Hi there", created_at: "2026-11-12T10:00:00.000001+00:00" },
    { id: "a2222222-2222-4222-8222-222222222222", role: "bot", body: "Hello!", created_at: "2026-11-12T10:00:00.000002+00:00" },
    { id: "a3333333-3333-4333-8333-333333333333", role: "visitor", body: "Refunds?", created_at: "2026-11-12T10:01:00+00:00" },
  ];

  it("returns the conversation and its messages oldest first, via the owner client only", async () => {
    results = [
      { data: { id: CONV, visitor_id: "v1", created_at: "2026-11-12T10:00:00+00:00" }, error: null },
      { data: messages, error: null },
    ];
    const out = await getConversationThread(CONV);
    expect(serviceClient).not.toHaveBeenCalled();
    expect(out?.messages.map((m) => ChatMessageSchema.parse(m).body)).toEqual(["Hi there", "Hello!", "Refunds?"]);
    expect(out?.conversation).toEqual({
      id: CONV,
      visitorId: "v1",
      firstMessagePreview: "Hi there",
      messageCount: 3,
      createdAt: "2026-11-12T10:00:00+00:00",
    });
    expect(queries.map((q) => q.table)).toEqual(["conversations", "messages"]);
    expect(queries[1]?.calls).toEqual([
      ["select", ["id, role, body, created_at"]],
      ["eq", ["conversation_id", CONV]],
      ["order", ["created_at", { ascending: true }]],
      ["order", ["id", { ascending: true }]],
    ]);
  });
  it("returns null (and reads no messages) when RLS hides the conversation", async () => {
    results = [{ data: null, error: null }];
    expect(await getConversationThread(CONV)).toBeNull();
    expect(queries).toHaveLength(1);
  });
  it("throws on a database error", async () => {
    results = [{ data: null, error: { message: "down" } }];
    await expect(getConversationThread(CONV)).rejects.toThrow("down");
    results = [
      { data: { id: CONV, visitor_id: "v1", created_at: "2026-11-12T10:00:00+00:00" }, error: null },
      { data: null, error: { message: "messages down" } },
    ];
    await expect(getConversationThread(CONV)).rejects.toThrow("messages down");
  });
});
