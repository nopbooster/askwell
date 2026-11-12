import { describe, expect, it, vi } from "vitest";
import type { ChatRequest } from "@askwell/shared";
import {
  CHAT_ENDPOINT,
  CHAT_ERROR_MESSAGES,
  ChatError,
  chatErrorKindFor,
  chatErrorMessage,
  createChatClient,
} from "./chat-client";
import {
  clearConversationId,
  conversationStorageKey,
  loadConversationId,
  saveConversationId,
} from "./conversation-store";

const KEY = "pk_abcdefghijklmnop1234";
const CONVERSATION_ID = "00000000-0000-4000-8000-0000000000aa";

const req: ChatRequest = {
  key: KEY,
  visitorId: "visitor-1",
  message: "How do refunds work?",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function apiError(code: string) {
  return { error: { code, message: "server text that must never reach the visitor" } };
}

function clientWith(res: Response | Error) {
  const fetchImpl = vi.fn(async () => {
    if (res instanceof Error) throw res;
    return res;
  });
  return { chat: createChatClient({ fetchImpl: fetchImpl as unknown as typeof fetch }), fetchImpl };
}

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

describe("real chat client", () => {
  it("POSTs the request as JSON to the same-origin route and parses the response", async () => {
    const { chat, fetchImpl } = clientWith(
      json(200, { conversationId: CONVERSATION_ID, reply: "Refunds take 5 days." }),
    );
    await expect(chat(req)).resolves.toEqual({
      conversationId: CONVERSATION_ID,
      reply: "Refunds take 5 days.",
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(CHAT_ENDPOINT);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(req);
  });

  it("carries the conversationId into the next request", async () => {
    const { chat, fetchImpl } = clientWith(
      json(200, { conversationId: CONVERSATION_ID, reply: "ok" }),
    );
    await chat({ ...req, conversationId: CONVERSATION_ID, message: "And for gift cards?" });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).conversationId).toBe(CONVERSATION_ID);
  });

  it.each([
    [429, "rate_limited", "rate_limited"],
    [429, "quota_exceeded", "quota_reached"],
    [400, "message_blocked", "blocked"],
    [400, "validation_failed", "generic"],
    [404, "not_found", "generic"],
    [500, "internal", "generic"],
    [429, "internal", "generic"],
  ] as const)("maps %i %s to %s", async (status, code, kind) => {
    const { chat } = clientWith(json(status, apiError(code)));
    const err = await chat(req).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ChatError);
    expect((err as ChatError).kind).toBe(kind);
    expect((err as ChatError).status).toBe(status);
    // The visitor sees our friendly text, never the server's.
    expect(chatErrorMessage(err)).toBe(CHAT_ERROR_MESSAGES[kind]);
  });

  it("shows the friendly blocked message", () => {
    expect(CHAT_ERROR_MESSAGES.blocked).toBe("I can't help with that request.");
  });

  it("maps a network failure to generic", async () => {
    const { chat } = clientWith(new TypeError("Failed to fetch"));
    const err = await chat(req).catch((e: unknown) => e);
    expect((err as ChatError).kind).toBe("generic");
  });

  it("maps a non-JSON error body to generic", async () => {
    const { chat } = clientWith(new Response("<html>502</html>", { status: 502 }));
    const err = await chat(req).catch((e: unknown) => e);
    expect((err as ChatError).kind).toBe("generic");
  });

  it("maps a 200 with a malformed body to generic", async () => {
    const { chat } = clientWith(json(200, { reply: "no conversation id" }));
    const err = await chat(req).catch((e: unknown) => e);
    expect((err as ChatError).kind).toBe("generic");
  });

  it("chatErrorKindFor needs both status and code to match", () => {
    expect(chatErrorKindFor(429, "rate_limited")).toBe("rate_limited");
    expect(chatErrorKindFor(400, "rate_limited")).toBe("generic");
    expect(chatErrorKindFor(500, undefined)).toBe("generic");
  });
});

describe("conversation store", () => {
  it("round-trips the conversation id per public key", () => {
    const storage = fakeStorage();
    expect(loadConversationId(KEY, storage)).toBeUndefined();
    saveConversationId(KEY, CONVERSATION_ID, storage);
    expect(loadConversationId(KEY, storage)).toBe(CONVERSATION_ID);
    expect(loadConversationId("pk_otherotherother12345", storage)).toBeUndefined();
  });

  it("ignores a stored value that is not a UUID", () => {
    const storage = fakeStorage({ [conversationStorageKey(KEY)]: "not-a-uuid" });
    expect(loadConversationId(KEY, storage)).toBeUndefined();
  });

  it("clears the stored id", () => {
    const storage = fakeStorage();
    saveConversationId(KEY, CONVERSATION_ID, storage);
    clearConversationId(KEY, storage);
    expect(loadConversationId(KEY, storage)).toBeUndefined();
  });

  it("never throws when storage is blocked or missing", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadConversationId(KEY, blocked)).toBeUndefined();
    expect(() => saveConversationId(KEY, CONVERSATION_ID, blocked)).not.toThrow();
    expect(() => clearConversationId(KEY, blocked)).not.toThrow();
    expect(loadConversationId(KEY, null)).toBeUndefined();
  });
});
