import type { MessageRole } from "@askwell/shared";
import { Markdown } from "../ui/markdown";

export type PanelMessage = { id: string; role: MessageRole; text: string };

/**
 * One chat bubble. Never HTML: the visitor's text is a plain React text node; the bot's reply goes
 * through the safe markdown subset (React elements only, project.md §9 XSS).
 */
export function MessageBubble({ message }: { message: PanelMessage }) {
  const mine = message.role === "visitor";
  if (mine) {
    return (
      <li className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-panel bg-accent px-3.5 py-2 text-sm leading-relaxed text-accent-fg">
          <span className="sr-only">You: </span>
          {message.text}
        </p>
      </li>
    );
  }
  return (
    <li className="flex justify-start">
      <div className="glass min-w-0 max-w-[85%] rounded-panel px-3.5 py-2 text-sm leading-relaxed text-fg">
        <span className="sr-only">Assistant: </span>
        <Markdown text={message.text} />
      </div>
    </li>
  );
}

export function TypingIndicator() {
  return (
    <li
      className="flex justify-start"
      role="status"
      aria-label="Assistant is typing"
    >
      <span
        className="glass inline-flex items-center gap-1 rounded-panel px-3.5 py-3"
        aria-hidden="true"
      >
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-1.5 animate-pulse rounded-full bg-fg-muted"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
    </li>
  );
}

export function MessageList({
  messages,
  typing,
}: {
  messages: PanelMessage[];
  typing: boolean;
}) {
  return (
    <ul
      className="flex flex-col gap-2.5"
      aria-live="polite"
      aria-label="Conversation"
    >
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      {typing ? <TypingIndicator /> : null}
    </ul>
  );
}
