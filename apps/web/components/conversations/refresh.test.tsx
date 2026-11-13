// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage, ConversationSummary } from "@askwell/shared";
import { ConversationsView } from "./conversations-view";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CONV: ConversationSummary = {
  id: "22222222-2222-4222-8222-222222222222",
  visitorId: "v1",
  firstMessagePreview: "Do you ship to Canada?",
  messageCount: 1,
  createdAt: "2026-11-13T09:00:00Z",
};
const msg = (n: number, role: ChatMessage["role"], body: string): ChatMessage => ({
  id: `4444444${n}-4444-4444-8444-444444444444`,
  role,
  body,
  createdAt: `2026-11-13T09:0${n}:00Z`,
});

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  window.matchMedia = vi.fn(() => ({ matches: false }) as unknown as MediaQueryList);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const button = (label: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(label)) as HTMLButtonElement;
async function click(el: HTMLElement) {
  await act(async () => {
    el.click();
  });
}

describe("ConversationsView refresh", () => {
  it("picks up a new chat after Refresh", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ conversations: [CONV] })));
    act(() => root.render(<ConversationsView projectId="p1" initialConversations={[]} />));
    expect(container.textContent).toContain("No conversations yet");

    await click(button("Refresh"));
    expect(container.textContent).toContain("Do you ship to Canada?");
    expect(container.textContent).toContain("1 message");
  });

  it("opens a thread and Refresh shows its new messages", async () => {
    let messages = [msg(1, "visitor", "Do you ship to Canada?")];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.startsWith("/api/conversations/")
          ? Response.json({ conversation: { ...CONV, messageCount: messages.length }, messages })
          : Response.json({ conversations: [{ ...CONV, messageCount: messages.length }] }),
      ),
    );
    act(() => root.render(<ConversationsView projectId="p1" initialConversations={[CONV]} />));

    await click(button("Do you ship to Canada?"));
    expect(container.querySelector('[aria-label="Messages"]')?.textContent).toContain("Do you ship to Canada?");
    expect(container.textContent).not.toContain("Yes, we do.");

    messages = [...messages, msg(2, "bot", "Yes, we do.")];
    await click(button("Refresh"));
    expect(container.querySelector('[aria-label="Messages"]')?.textContent).toContain("Yes, we do.");
    expect(container.textContent).toContain("2 messages");
  });

  it("keeps the list and shows a note when Refresh fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    act(() => root.render(<ConversationsView projectId="p1" initialConversations={[CONV]} />));
    await click(button("Refresh"));
    expect(container.textContent).toContain("Do you ship to Canada?");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Couldn't refresh");
  });

  it("shows an error with Retry when a thread fails to load", async () => {
    const fetchMock = vi.fn(async () => Response.json({ error: { code: "internal", message: "x" } }, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    act(() => root.render(<ConversationsView projectId="p1" initialConversations={[CONV]} />));
    await click(button("Do you ship to Canada?"));
    expect(container.textContent).toContain("Couldn't load this conversation");

    fetchMock.mockImplementation(async () => Response.json({ conversation: CONV, messages: [msg(1, "visitor", "Do you ship to Canada?")] }));
    await click(button("Retry"));
    expect(container.querySelector('[aria-label="Messages"]')).not.toBeNull();
  });
});
