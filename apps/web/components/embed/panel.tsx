"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  APP_NAME,
  MAX_MESSAGE_CHARS,
  type WidgetConfig,
} from "@askwell/shared";
import {
  ChatError,
  chatErrorMessage,
  realChat,
  type ChatClient,
} from "./chat-client";
import { clearConversationId, loadConversationId, saveConversationId } from "./conversation-store";
import { MessageList, type PanelMessage } from "./message-list";
import { createParentChannel } from "./parent-channel";
import { getVisitorId } from "./visitor-id";

type PanelProps = {
  publicKey: string;
  /** Parent page origin from the query, already validated. Null: never post anywhere. */
  parentOrigin: string | null;
  config: Pick<WidgetConfig, "headerText" | "showBadge">;
  /** Defaults to the real route; tests pass the mock. */
  chat?: ChatClient;
};

export function Panel({
  publicKey,
  parentOrigin,
  config,
  chat = realChat,
}: PanelProps) {
  const [messages, setMessages] = useState<PanelMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationId = useRef<string | undefined>(undefined);
  const visitorId = useRef<string | null>(null);
  const nextId = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  const channel = useMemo(
    () =>
      typeof window === "undefined"
        ? null
        : createParentChannel(window, parentOrigin, () => {}),
    [parentOrigin],
  );

  useEffect(() => {
    channel?.post({ type: "ready" });
    return () => channel?.dispose();
  }, [channel]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages, pending]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || pending || text.length > MAX_MESSAGE_CHARS) return;
    visitorId.current ??= getVisitorId();
    // Resume the session's conversation (after a reload, the bot still remembers it).
    conversationId.current ??= loadConversationId(publicKey);
    setError(null);
    setInput("");
    setPending(true);
    setMessages((m) => [
      ...m,
      { id: `m${nextId.current++}`, role: "visitor", text },
    ]);
    try {
      const res = await chat({
        key: publicKey,
        visitorId: visitorId.current,
        conversationId: conversationId.current,
        message: text,
      });
      conversationId.current = res.conversationId;
      saveConversationId(publicKey, res.conversationId);
      setMessages((m) => [
        ...m,
        { id: `m${nextId.current++}`, role: "bot", text: res.reply },
      ]);
    } catch (e) {
      // A 404 means the stored conversation is gone or not ours: start a new one next time.
      if (e instanceof ChatError && e.status === 404) {
        conversationId.current = undefined;
        clearConversationId(publicKey);
      }
      setError(chatErrorMessage(e));
      setInput(text); // let them resend without retyping
    } finally {
      setPending(false);
    }
  }, [chat, input, pending, publicKey]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  };

  const tooLong = input.length > MAX_MESSAGE_CHARS;

  return (
    <div className="flex h-dvh flex-col bg-canvas text-fg">
      <header className="glass flex items-center justify-between gap-3 rounded-none border-x-0 border-t-0 px-4 py-3">
        <h1 className="truncate text-sm font-semibold">{config.headerText}</h1>
        <button
          type="button"
          aria-label="Close chat"
          onClick={() => channel?.post({ type: "close" })}
          className="grid size-8 shrink-0 place-items-center rounded-control text-fg-muted transition hover:bg-surface-strong hover:text-fg focus-visible:outline-2 focus-visible:outline-fg"
        >
          <svg
            viewBox="0 0 16 16"
            className="size-4"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !pending ? (
          <p className="mt-8 text-center text-sm text-fg-muted">
            Hi! Ask a question to get started.
          </p>
        ) : null}
        <MessageList messages={messages} typing={pending} />
        <div ref={endRef} />
      </div>

      <footer className="border-t border-line px-3 pb-2 pt-3">
        {error ? (
          <p
            role="alert"
            className="mb-2 rounded-control bg-surface px-3 py-2 text-xs text-danger"
          >
            {error}
          </p>
        ) : null}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={MAX_MESSAGE_CHARS + 50}
            placeholder="Type your question…"
            aria-label="Your message"
            className="glass max-h-28 min-h-10 flex-1 resize-none rounded-control px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-fg"
          />
          <button
            type="submit"
            disabled={pending || !input.trim() || tooLong}
            className="min-h-10 shrink-0 rounded-control bg-accent px-4 text-sm font-medium text-accent-fg shadow-raised transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </form>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-fg-muted">
          <span>{config.showBadge ? `Powered by ${APP_NAME}` : null}</span>
          <span
            className={tooLong ? "text-danger" : undefined}
            aria-label="Characters used"
          >
            {input.length}/{MAX_MESSAGE_CHARS}
          </span>
        </div>
      </footer>
    </div>
  );
}
