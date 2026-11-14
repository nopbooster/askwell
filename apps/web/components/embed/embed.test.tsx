import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_NAME, MAX_VISITOR_ID_CHARS, parseWidgetMessage } from "@askwell/shared";
import {
  CHAT_ERROR_MESSAGES,
  ChatError,
  MOCK_CONVERSATION_ID,
  MOCK_REPLY,
  chatErrorMessage,
  createMockChat,
} from "./chat-client";
import { MessageList } from "./message-list";
import { Panel } from "./panel";
import { parseParentOrigin, readEmbedParams } from "./params";
import { createParentChannel, isTrustedParentMessage } from "./parent-channel";
import {
  VISITOR_ID_STORAGE_KEY,
  getVisitorId,
  resetVisitorIdMemory,
} from "./visitor-id";

const KEY = "pk_abcdefghijklmnop1234";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

afterEach(() => {
  resetVisitorIdMemory();
  vi.useRealTimers();
});

describe("getVisitorId", () => {
  it("creates an ID, stores it, and reuses it", () => {
    const store = fakeStorage();
    const id = getVisitorId(store);
    expect(id.length).toBeGreaterThan(0);
    expect(id.length).toBeLessThanOrEqual(MAX_VISITOR_ID_CHARS);
    expect(store.data.get(VISITOR_ID_STORAGE_KEY)).toBe(id);
    expect(getVisitorId(store)).toBe(id);
  });

  it("reuses an ID already stored by an earlier visit", () => {
    expect(
      getVisitorId(
        fakeStorage({ [VISITOR_ID_STORAGE_KEY]: "earlier-visit-id" }),
      ),
    ).toBe("earlier-visit-id");
  });

  it("replaces a stored value that is not a valid ID", () => {
    const store = fakeStorage({
      [VISITOR_ID_STORAGE_KEY]: "<script>alert(1)</script>",
    });
    const id = getVisitorId(store);
    expect(id).not.toContain("<");
    expect(store.data.get(VISITOR_ID_STORAGE_KEY)).toBe(id);
  });

  it("falls back to a stable in-memory ID when every storage call throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const a = getVisitorId(broken);
    expect(a.length).toBeGreaterThan(0);
    expect(getVisitorId(broken)).toBe(a);
  });

  it("works when there is no storage object at all", () => {
    const a = getVisitorId(null);
    expect(getVisitorId(null)).toBe(a);
  });

  it("works when reading window.localStorage throws", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("SecurityError");
      },
    });
    try {
      const a = getVisitorId();
      expect(getVisitorId()).toBe(a);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("parseParentOrigin", () => {
  it.each([
    "https://example.com",
    "http://localhost:3000",
    "https://a.b.example.co.uk:8443",
  ])("accepts %s", (o) => {
    expect(parseParentOrigin(o)).toBe(o);
  });

  it.each([
    null,
    undefined,
    "",
    "null",
    "*",
    "example.com",
    "javascript:alert(1)",
    "data:text/html,hi",
    "ftp://example.com",
    "https://example.com/",
    "https://example.com/path",
    "https://example.com?x=1",
    "https://user:pw@example.com",
  ])("rejects %j", (o) => {
    expect(parseParentOrigin(o)).toBeNull();
  });
});

describe("readEmbedParams", () => {
  it("reads a valid key and origin", () => {
    expect(
      readEmbedParams({ key: KEY, origin: "https://example.com" }),
    ).toEqual({
      key: KEY,
      origin: "https://example.com",
    });
  });
  it("treats a bad or missing key as null", () => {
    expect(readEmbedParams({ origin: "https://example.com" }).key).toBeNull();
    expect(readEmbedParams({ key: "nope" }).key).toBeNull();
    expect(readEmbedParams({ key: "sk_abcdefghijklmnop1234" }).key).toBeNull();
  });
  it("takes the first value of a repeated param", () => {
    expect(
      readEmbedParams({
        key: [KEY, "x"],
        origin: ["https://a.com", "https://b.com"],
      }),
    ).toEqual({
      key: KEY,
      origin: "https://a.com",
    });
  });
  it("drops a bad origin but keeps the key", () => {
    expect(
      readEmbedParams({ key: KEY, origin: "https://example.com/x" }),
    ).toEqual({ key: KEY, origin: null });
  });
});

describe("mock chat", () => {
  it("waits ~800 ms, then returns the fixed reply and a stable conversation id", async () => {
    vi.useFakeTimers();
    const chat = createMockChat();
    const p = chat({ key: KEY, visitorId: "v1", message: "hello" });
    let done = false;
    void p.then(() => (done = true));
    await vi.advanceTimersByTimeAsync(799);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await p).toEqual({
      conversationId: MOCK_CONVERSATION_ID,
      reply: MOCK_REPLY,
    });
  });

  it("keeps the conversation id it is given", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const res = await createMockChat({ delayMs: 0 })({
      key: KEY,
      visitorId: "v1",
      conversationId: id,
      message: "hi",
    });
    expect(res.conversationId).toBe(id);
  });

  it.each([
    ["[rate-limit]", "rate_limited"],
    ["[quota]", "quota_reached"],
    ["[error]", "generic"],
  ] as const)("trigger %s gives the %s error", async (trigger, kind) => {
    const chat = createMockChat({ delayMs: 0 });
    const err = await chat({
      key: KEY,
      visitorId: "v1",
      message: `hi ${trigger}`,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ChatError);
    expect((err as ChatError).kind).toBe(kind);
    expect(chatErrorMessage(err)).toBe(CHAT_ERROR_MESSAGES[kind]);
  });

  it("shows the generic message for unknown errors", () => {
    expect(chatErrorMessage(new TypeError("boom"))).toBe(
      CHAT_ERROR_MESSAGES.generic,
    );
  });
});

describe("parent channel", () => {
  function setup(parentOrigin: string | null, framed = true) {
    const parent = { postMessage: vi.fn() };
    const listeners: ((e: MessageEvent) => void)[] = [];
    const win = {
      parent: undefined as unknown,
      addEventListener: (_t: "message", l: (e: MessageEvent) => void) =>
        void listeners.push(l),
      removeEventListener: (_t: "message", l: (e: MessageEvent) => void) => {
        listeners.splice(listeners.indexOf(l), 1);
      },
    };
    win.parent = framed ? parent : win;
    const received: unknown[] = [];
    const channel = createParentChannel(
      win as unknown as Parameters<typeof createParentChannel>[0],
      parentOrigin,
      (d) => received.push(d),
    );
    const deliver = (origin: string, source: unknown, data: unknown) =>
      listeners.forEach((l) => l({ origin, source, data } as MessageEvent));
    return { parent, channel, received, deliver, listeners };
  }

  it("posts valid protocol messages to the parent, only ever to the given origin", () => {
    const { parent, channel } = setup("https://example.com");
    channel.post({ type: "ready" });
    channel.post({ type: "close" });
    channel.post({ type: "unread", count: 2 });
    expect(parent.postMessage).toHaveBeenCalledTimes(3);
    for (const [msg, target] of parent.postMessage.mock.calls) {
      expect(target).toBe("https://example.com");
      expect(target).not.toBe("*");
      expect(parseWidgetMessage(msg)).not.toBeNull();
    }
  });

  it("posts nothing without a valid parent origin", () => {
    const { parent, channel } = setup(null);
    expect(channel.post({ type: "ready" })).toBeNull();
    expect(parent.postMessage).not.toHaveBeenCalled();
  });

  it("posts nothing when the page is not inside a frame", () => {
    const { parent, channel } = setup("https://example.com", false);
    expect(channel.post({ type: "close" })).toBeNull();
    expect(parent.postMessage).not.toHaveBeenCalled();
  });

  it("accepts incoming messages only from the parent at the given origin", () => {
    const { parent, received, deliver } = setup("https://example.com");
    deliver("https://evil.example", parent, "from the wrong origin");
    deliver(
      "https://example.com",
      { other: "window" },
      "from the wrong window",
    );
    deliver("https://example.com", parent, "ok");
    expect(received).toEqual(["ok"]);
  });

  it("removes its listener on dispose", () => {
    const { channel, listeners } = setup("https://example.com");
    expect(listeners).toHaveLength(1);
    channel.dispose();
    expect(listeners).toHaveLength(0);
  });

  it("isTrustedParentMessage rejects everything without an origin", () => {
    const w = {};
    expect(
      isTrustedParentMessage(
        { origin: "https://example.com", source: w as MessageEventSource },
        null,
        w,
      ),
    ).toBe(false);
  });
});

describe("MessageList", () => {
  it("renders message text literally, never as HTML", () => {
    const evil = `<b>bold</b><script>alert(1)</script><img src=x onerror=alert(1)>`;
    const html = renderToStaticMarkup(
      <MessageList
        typing={false}
        messages={[
          { id: "1", role: "visitor", text: evil },
          { id: "2", role: "bot", text: evil },
        ]}
      />,
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<b>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("shows the typing indicator only while waiting", () => {
    expect(
      renderToStaticMarkup(<MessageList messages={[]} typing />),
    ).toContain("Assistant is typing");
    expect(
      renderToStaticMarkup(<MessageList messages={[]} typing={false} />),
    ).not.toContain("typing");
  });
});

describe("Panel config", () => {
  const render = (config: { headerText: string; showBadge: boolean }) =>
    renderToStaticMarkup(<Panel publicKey={KEY} parentOrigin={null} config={config} chat={createMockChat()} />);

  it("shows the configured header text", () => {
    expect(render({ headerText: "Hi from Pro", showBadge: true })).toContain("Hi from Pro");
  });

  it("renders the header as text, never HTML", () => {
    const html = render({ headerText: "<img src=x onerror=alert(1)>", showBadge: true });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("shows the badge when showBadge is true (always the case for Free)", () => {
    expect(render({ headerText: "Ask us anything", showBadge: true })).toContain(`Powered by ${APP_NAME}`);
  });

  it("hides the badge only when showBadge is false (Pro)", () => {
    expect(render({ headerText: "Ask us anything", showBadge: false })).not.toContain("Powered by");
  });
});
