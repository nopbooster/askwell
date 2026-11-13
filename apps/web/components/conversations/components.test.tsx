import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ChatMessage, ConversationSummary } from "@askwell/shared";
import { ConversationList } from "./conversation-list";
import { ConversationsView } from "./conversations-view";
import { ThreadView } from "./thread-view";

const XSS = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
const conv = (id: string, preview: string, count: number, createdAt: string): ConversationSummary => ({
  id,
  visitorId: `visitor-${id.slice(0, 4)}`,
  firstMessagePreview: preview,
  messageCount: count,
  createdAt,
});
const NEWER = conv("22222222-2222-4222-8222-222222222222", "Do you ship to Canada?", 4, "2026-11-13T09:00:00Z");
const OLDER = conv("33333333-3333-4333-8333-333333333333", "Refund policy?", 1, "2026-11-12T10:01:00Z");
const msg = (n: number, role: ChatMessage["role"], body: string): ChatMessage => ({
  id: `4444444${n}-4444-4444-8444-444444444444`,
  role,
  body,
  createdAt: `2026-11-12T10:0${n}:00Z`,
});

describe("ConversationList", () => {
  const render = (list: ConversationSummary[], selectedId: string | null = null) =>
    renderToStaticMarkup(<ConversationList conversations={list} selectedId={selectedId} onSelect={() => undefined} />);

  it("shows preview, count and time for each conversation, in the API's order", () => {
    const html = render([NEWER, OLDER]);
    expect(html).toContain("Do you ship to Canada?");
    expect(html).toContain("4 messages");
    expect(html).toContain("1 message<");
    expect(html).toContain("Nov 13, 2026, 09:00 UTC");
    expect(html.indexOf("Do you ship")).toBeLessThan(html.indexOf("Refund policy"));
  });
  it("marks the selected conversation", () => {
    const html = render([NEWER, OLDER], OLDER.id);
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expect(html.indexOf('aria-current="true"')).toBeGreaterThan(html.indexOf("Do you ship"));
  });
  it("shows a placeholder when there is no visitor message", () => {
    expect(render([conv(NEWER.id, "", 0, NEWER.createdAt)])).toContain("No visitor message yet");
  });
  it("renders a preview as text, never HTML", () => {
    const html = render([conv(NEWER.id, XSS, 1, NEWER.createdAt)]);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;img");
  });
});

describe("ThreadView", () => {
  const render = (messages: ChatMessage[]) =>
    renderToStaticMarkup(<ThreadView thread={{ conversation: NEWER, messages }} />);

  it("shows every message in order, visitor and bot styled differently", () => {
    const html = render([msg(1, "visitor", "Hi there"), msg(2, "bot", "Hello! How can I help?"), msg(3, "visitor", "Shipping?")]);
    const order = ["Hi there", "Hello! How can I help?", "Shipping?"].map((t) => html.indexOf(t));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html).toContain("items-end"); // visitor, right
    expect(html).toContain("items-start"); // bot, left
    expect(html).toContain("bg-accent"); // visitor bubble
    expect(html).toContain("Visitor: ");
    expect(html).toContain("Bot: ");
    expect(html).toContain("3 messages");
  });
  it("renders visitor and bot text as text, never HTML", () => {
    const html = render([msg(1, "visitor", XSS), msg(2, "bot", `**Sure** ${XSS}`)]);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html.match(/&lt;img/g)).toHaveLength(2);
  });
  it("keeps line breaks (pre-wrap) and shows an empty note with no messages", () => {
    expect(render([msg(1, "bot", "a\nb")])).toContain("whitespace-pre-wrap");
    expect(render([])).toContain("No messages in this conversation yet.");
  });
});

describe("ConversationsView", () => {
  const render = (list: ConversationSummary[]) =>
    renderToStaticMarkup(<ConversationsView projectId="p1" initialConversations={list} />);

  it("shows the empty state with a Refresh button when there are no conversations", () => {
    const html = render([]);
    expect(html).toContain("No conversations yet");
    expect(html).toContain(">Refresh<");
  });
  it("shows the list, a Refresh button and a prompt to pick a thread", () => {
    const html = render([NEWER, OLDER]);
    expect(html).toContain("Do you ship to Canada?");
    expect(html).toContain(">Refresh<");
    expect(html).toContain("Pick a conversation to read it.");
    expect(html).toContain("Newest 2 shown, newest first.");
  });
});
