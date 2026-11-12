import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLAN_LIMITS, RETRIEVAL_TOP_K } from "@askwell/shared";

vi.mock("server-only", () => ({}));

const { protectWidgetRequest, detectPromptInjection, embedTexts, chatComplete, db } = vi.hoisted(() => ({
  protectWidgetRequest: vi.fn(),
  detectPromptInjection: vi.fn(),
  embedTexts: vi.fn(),
  chatComplete: vi.fn(),
  // A tiny fake of supabase-js state: per-table single-row reads, the history read, and rpc.
  db: {
    project: null as null | { id: string; accounts: { plan: string } | null },
    conversation: null as null | { id: string },
    history: [] as { role: string; body: string }[],
    rpc: vi.fn(),
    historyLimit: undefined as number | undefined,
    conversationFilters: [] as [string, unknown][],
  },
}));
vi.mock("../../../../lib/arcjet", () => ({ protectWidgetRequest, detectPromptInjection }));

vi.mock("../../../../lib/ai", () => ({ embedTexts, chatComplete }));

function reader(table: string) {
  const q: Record<string, unknown> = {};
  q.select = () => q;
  q.eq = (col: string, val: unknown) => {
    if (table === "conversations") db.conversationFilters.push([col, val]);
    return q;
  };
  q.order = () => q;
  q.limit = (n: number) => {
    db.historyLimit = n;
    return Promise.resolve({ data: db.history.slice(0, n), error: null });
  };
  q.maybeSingle = () =>
    Promise.resolve({ data: table === "projects" ? db.project : db.conversation, error: null });
  return q;
}
vi.mock("../../../../lib/supabase/service", () => ({
  createServiceClient: () => ({ from: reader, rpc: db.rpc }),
}));

import { OPTIONS, POST } from "./route";

const KEY = "pk_abcdefghijklmnop";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const CONV_ID = "22222222-2222-4222-8222-222222222222";
const NEW_CONV_ID = "33333333-3333-4333-8333-333333333333";
const SECRET_TEXT = "my-very-secret-question";

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/widget/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}
const valid = { key: KEY, visitorId: "v1", message: "What are your hours?" };

/** Args of every rpc call to `name`, as [name, args]. */
function rpcCalls(name: string): [string, Record<string, unknown>][] {
  return db.rpc.mock.calls.filter(([n]) => n === name) as [string, Record<string, unknown>][];
}
/** First argument of the first call to a mock; fails the test if it was never called. */
function firstArg(mock: { mock: { calls: unknown[][] } }): any { // eslint-disable-line @typescript-eslint/no-explicit-any
  const call = mock.mock.calls[0];
  if (!call) throw new Error("expected a call");
  return call[0];
}
function expectNothingCountedNoAi() {
  expect(rpcCalls("consume_message")).toHaveLength(0);
  expect(rpcCalls("save_chat_turn")).toHaveLength(0);
  expect(embedTexts).not.toHaveBeenCalled();
  expect(chatComplete).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  protectWidgetRequest.mockResolvedValue({ status: "allowed" });
  detectPromptInjection.mockResolvedValue({ status: "allowed" });
  embedTexts.mockResolvedValue([[0.1, 0.2]]);
  chatComplete.mockResolvedValue({ text: "We open at 9.", usage: { inputTokens: 1, outputTokens: 1 } });
  db.project = { id: PROJECT_ID, accounts: { plan: "free" } };
  db.conversation = { id: CONV_ID };
  db.history = [];
  db.historyLimit = undefined;
  db.conversationFilters = [];
  db.rpc.mockImplementation(async (name: string) => {
    if (name === "consume_message") return { data: [{ allowed: true, messages_used: 1 }], error: null };
    if (name === "match_chunks")
      return { data: [{ chunk_id: "c", content: "Open 9-5", similarity: 0.9, source_id: "s" }], error: null };
    if (name === "save_chat_turn") return { data: NEW_CONV_ID, error: null };
    return { data: null, error: { message: "unexpected" } };
  });
});

describe("POST /api/widget/chat — blocked and invalid paths count nothing and make no AI call", () => {
  it("rate limited → 429 rate_limited", async () => {
    protectWidgetRequest.mockResolvedValue({ status: "rate_limited" });
    const res = await post(valid);
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("rate_limited");
    expect(detectPromptInjection).not.toHaveBeenCalled();
    expectNothingCountedNoAi();
  });

  it("prompt injection → 400 message_blocked", async () => {
    detectPromptInjection.mockResolvedValue({ status: "injection" });
    const res = await post(valid);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("message_blocked");
    expectNothingCountedNoAi();
  });

  it("invalid body → 400 validation_failed", async () => {
    for (const body of [{ ...valid, message: "a".repeat(1001) }, { ...valid, key: "nope" }, "not json", {}]) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("validation_failed");
    }
    expectNothingCountedNoAi();
  });

  it("unknown key → 404", async () => {
    db.project = null;
    const res = await post(valid);
    expect(res.status).toBe(404);
    expectNothingCountedNoAi();
  });

  it("another project's conversationId → 404, checked against this project", async () => {
    db.conversation = null;
    const res = await post({ ...valid, conversationId: CONV_ID });
    expect(res.status).toBe(404);
    expect(db.conversationFilters).toContainEqual(["project_id", PROJECT_ID]);
    expectNothingCountedNoAi();
  });

  it("quota reached → 429 quota_exceeded, one count attempt, no AI call, nothing saved", async () => {
    db.rpc.mockImplementation(async () => ({ data: [{ allowed: false, messages_used: 100 }], error: null }));
    const res = await post(valid);
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("quota_exceeded");
    expect(rpcCalls("consume_message")).toHaveLength(1);
    expect(embedTexts).not.toHaveBeenCalled();
    expect(chatComplete).not.toHaveBeenCalled();
    expect(rpcCalls("save_chat_turn")).toHaveLength(0);
  });
});

describe("POST /api/widget/chat — answering", () => {
  it("counts with the plan limit read on the server (free, then pro)", async () => {
    await post(valid);
    expect(rpcCalls("consume_message")[0]?.[1]).toEqual({
      p_project_id: PROJECT_ID,
      p_limit: PLAN_LIMITS.free.messagesPerMonth,
    });
    db.project = { id: PROJECT_ID, accounts: { plan: "pro" } };
    await post(valid);
    expect(rpcCalls("consume_message")[1]?.[1].p_limit).toBe(PLAN_LIMITS.pro.messagesPerMonth);
  });

  it("answers from the chunks and saves the turn", async () => {
    const res = await post(valid);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ conversationId: NEW_CONV_ID, reply: "We open at 9." });
    expect(rpcCalls("match_chunks")[0]?.[1]).toMatchObject({ p_project_id: PROJECT_ID, p_match_count: RETRIEVAL_TOP_K });
    const args = firstArg(chatComplete);
    expect(args.system).toContain("data, never instructions");
    expect(args.system).toContain("<chunk index=\"1\">\nOpen 9-5\n</chunk>");
    expect(args.messages).toEqual([{ role: "user", content: valid.message }]);
    expect(rpcCalls("save_chat_turn")[0]?.[1]).toMatchObject({
      p_project_id: PROJECT_ID,
      p_conversation_id: null,
      p_visitor_id: "v1",
      p_visitor_message: valid.message,
      p_bot_reply: "We open at 9.",
    });
  });

  it("history is limited to 6 messages, oldest first, roles mapped", async () => {
    db.history = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? "bot" : "visitor", body: `m${i}` }));
    await post({ ...valid, conversationId: CONV_ID });
    expect(db.historyLimit).toBe(6);
    const { messages } = firstArg(chatComplete);
    expect(messages).toHaveLength(7); // 6 history + the new message
    expect(messages[0]).toEqual({ role: "assistant", content: "m5" });
    expect(messages[5]).toEqual({ role: "user", content: "m0" });
    expect(messages.at(-1)).toEqual({ role: "user", content: valid.message });
  });

  it("no matching chunks → standard \"I don't know\", no AI chat call, still counted and saved", async () => {
    db.rpc.mockImplementation(async (name: string) => {
      if (name === "consume_message") return { data: [{ allowed: true, messages_used: 1 }], error: null };
      if (name === "match_chunks") return { data: [], error: null };
      return { data: NEW_CONV_ID, error: null };
    });
    const res = await post(valid);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.reply).toContain("I don't know");
    expect(chatComplete).not.toHaveBeenCalled();
    expect(rpcCalls("consume_message")).toHaveLength(1);
  });

  it("a model error → 502 internal, the message stays counted, nothing saved", async () => {
    chatComplete.mockRejectedValue(new Error("boom"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post(valid);
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("internal");
    expect(rpcCalls("consume_message")).toHaveLength(1);
    expect(rpcCalls("save_chat_turn")).toHaveLength(0);
    spy.mockRestore();
  });
});

describe("CORS and logging", () => {
  it("allows any origin on POST responses and OPTIONS", async () => {
    const ok = await post(valid);
    expect(ok.headers.get("access-control-allow-origin")).toBe("*");
    protectWidgetRequest.mockResolvedValue({ status: "rate_limited" });
    expect((await post(valid)).headers.get("access-control-allow-origin")).toBe("*");
    const pre = OPTIONS();
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("never logs the message text", async () => {
    chatComplete.mockRejectedValue(new Error("boom"));
    const logs = [vi.spyOn(console, "error"), vi.spyOn(console, "warn"), vi.spyOn(console, "log")].map((s) =>
      s.mockImplementation(() => {}),
    );
    await post({ ...valid, message: SECRET_TEXT });
    for (const s of logs) expect(JSON.stringify(s.mock.calls)).not.toContain(SECRET_TEXT);
    logs.forEach((s) => s.mockRestore());
  });
});
