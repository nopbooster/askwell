/**
 * "Nov 12, 2026, 10:01 UTC". UTC, so the server render and the browser render match (no hydration
 * mismatch) and every owner reads the same time. Empty string for an unreadable date.
 */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const text = date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  });
  return `${text} UTC`;
}

/** "1 message", "12 messages". */
export function messageCountLabel(count: number): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "message" : "messages"}`;
}

/** The list row title: the first visitor message, or a placeholder when there isn't one yet. */
export function previewLabel(preview: string): string {
  return preview.trim() === "" ? "No visitor message yet" : preview;
}
