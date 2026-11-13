import type { ChatMessage, GetConversationResponse } from "@askwell/shared";
import { GlassPanel } from "../ui";
import { formatTimestamp, messageCountLabel } from "./format";

const ROLE_LABEL: Record<ChatMessage["role"], string> = { visitor: "Visitor", bot: "Bot" };

/**
 * One message. Visitor on the right in solid black, bot on the left in glass. The body is a React
 * text node, never HTML (project.md §9 XSS); `whitespace-pre-wrap` keeps the line breaks.
 */
export function ThreadMessage({ message }: { message: ChatMessage }) {
  const visitor = message.role === "visitor";
  return (
    <li className={`flex flex-col ${visitor ? "items-end" : "items-start"}`}>
      <p
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-panel px-3.5 py-2 text-sm leading-relaxed ${
          visitor ? "bg-accent text-accent-fg" : "glass text-fg"
        }`}
      >
        <span className="sr-only">{ROLE_LABEL[message.role]}: </span>
        {message.body}
      </p>
      <span className="mt-1 px-1 text-xs text-fg-muted">
        {ROLE_LABEL[message.role]} · <time dateTime={message.createdAt}>{formatTimestamp(message.createdAt)}</time>
      </span>
    </li>
  );
}

/** The full thread, oldest first (the API's order). */
export function ThreadView({ thread }: { thread: GetConversationResponse }) {
  const { conversation, messages } = thread;
  return (
    <GlassPanel className="p-4 sm:p-5">
      <header className="mb-4 border-b border-line pb-3">
        <h2 className="text-base font-medium">Conversation</h2>
        <p className="mt-0.5 text-xs text-fg-muted">
          Started {formatTimestamp(conversation.createdAt)} · {messageCountLabel(messages.length)}
        </p>
        <p className="mt-0.5 text-xs text-fg-muted">
          Visitor <span className="break-all">{conversation.visitorId}</span>
        </p>
      </header>
      {messages.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-muted">No messages in this conversation yet.</p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Messages">
          {messages.map((m) => (
            <ThreadMessage key={m.id} message={m} />
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}
