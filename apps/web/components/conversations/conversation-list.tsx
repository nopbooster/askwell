import type { ConversationSummary } from "@askwell/shared";
import { GlassPanel } from "../ui";
import { formatTimestamp, messageCountLabel, previewLabel } from "./format";

/** The conversation list, newest first (the API's order). Every preview renders as text, never HTML. */
export function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: {
  conversations: ConversationSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <GlassPanel className="overflow-hidden">
      <ul className="divide-y divide-line" aria-label="Conversations">
        {conversations.map((c) => {
          const selected = c.id === selectedId;
          const empty = c.firstMessagePreview.trim() === "";
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                aria-current={selected ? "true" : undefined}
                className={`block w-full px-4 py-3 text-left transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-fg sm:px-5 ${
                  selected ? "bg-surface-strong" : "hover:bg-surface"
                }`}
              >
                <span className={`line-clamp-2 text-sm break-words ${empty ? "text-fg-muted italic" : "font-medium"}`}>
                  {previewLabel(c.firstMessagePreview)}
                </span>
                <span className="mt-1 flex flex-wrap gap-x-2 text-xs text-fg-muted">
                  <span>{messageCountLabel(c.messageCount)}</span>
                  <span aria-hidden>·</span>
                  <time dateTime={c.createdAt}>{formatTimestamp(c.createdAt)}</time>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </GlassPanel>
  );
}
