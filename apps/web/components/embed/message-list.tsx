import type { MessageRole } from "@askwell/shared";

export type PanelMessage = { id: string; role: MessageRole; text: string };

/** One chat bubble. The text is always a React text node, never HTML. */
export function MessageBubble({ message }: { message: PanelMessage }) {
  const mine = message.role === "visitor";
  return (
    <li className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-panel px-3.5 py-2 text-sm leading-relaxed ${
          mine ? "bg-accent text-accent-fg" : "glass text-fg"
        }`}
      >
        <span className="sr-only">{mine ? "You: " : "Assistant: "}</span>
        {message.text}
      </p>
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
