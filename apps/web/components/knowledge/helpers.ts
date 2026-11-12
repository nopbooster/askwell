import {
  KNOWLEDGE_FILE_TYPES,
  MAX_KNOWLEDGE_FILE_BYTES,
  PLAN_LIMITS,
  type KnowledgeSource,
  type KnowledgeSourceStatus,
  type KnowledgeSourceType,
  type Plan,
} from "@askwell/shared";

const PLAN_NAMES = { free: "Free", pro: "Pro" } as const;

export type StatusView = "processing" | "ready" | "failed";

/** `uploading` shows as Processing (project.md §6.4). */
export function statusView(status: KnowledgeSourceStatus): StatusView {
  return status === "ready" ? "ready" : status === "failed" ? "failed" : "processing";
}

export const STATUS_LABELS: Record<StatusView, string> = {
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
};

export const TYPE_LABELS: Record<KnowledgeSourceType, string> = {
  text: "Text",
  pdf: "PDF",
  md: "Markdown",
  txt: "TXT",
};

/** The short reason shown next to a failed source. The server doesn't send one, so it depends on the type. */
export function failedMessage(type: KnowledgeSourceType): string {
  return type === "text"
    ? "We couldn't process this text. Delete it and try again."
    : "We couldn't read text from this file. Delete it and try another.";
}

/** "2 of 3 sources on Free". */
export function sourceLimitLabel(count: number, plan: Plan): string {
  const limit = PLAN_LIMITS[plan].knowledgeSources;
  return `${count} of ${limit} ${limit === 1 ? "source" : "sources"} on ${PLAN_NAMES[plan]}`;
}

export function isAtSourceLimit(count: number, plan: Plan): boolean {
  return count >= PLAN_LIMITS[plan].knowledgeSources;
}

/** Poll every 2.5 s while anything is processing; give up after 5 minutes or 3 failed refreshes in a row. */
export const POLL_INTERVAL_MS = 2500;
export const POLL_MAX_MS = 5 * 60 * 1000;
export const POLL_MAX_FAILURES = 3;

export function hasProcessing(sources: readonly Pick<KnowledgeSource, "status">[]): boolean {
  return sources.some((s) => statusView(s.status) === "processing");
}

/** The polling stop rule: keep going only while something is processing and we haven't given up. */
export function shouldKeepPolling(
  sources: readonly Pick<KnowledgeSource, "status">[],
  elapsedMs: number,
  consecutiveFailures: number,
): boolean {
  return hasProcessing(sources) && elapsedMs < POLL_MAX_MS && consecutiveFailures < POLL_MAX_FAILURES;
}

export const ACCEPT_ATTRIBUTE = Object.values(KNOWLEDGE_FILE_TYPES)
  .flatMap((t) => t.extensions)
  .join(",");

export type FileCheck =
  | { ok: true; type: Exclude<KnowledgeSourceType, "text">; mimeType: string }
  | { ok: false; message: string };

/** Quick browser-side check of a picked file (the server checks again). Never trusts the browser's MIME type. */
export function checkFile(file: { name: string; size: number }): FileCheck {
  const name = file.name.toLowerCase();
  for (const [type, { extensions, mimeTypes }] of Object.entries(KNOWLEDGE_FILE_TYPES)) {
    if (extensions.some((e) => name.endsWith(e))) {
      if (file.size === 0) return { ok: false, message: "This file is empty." };
      if (file.size > MAX_KNOWLEDGE_FILE_BYTES) {
        return { ok: false, message: `This file is ${formatSize(file.size)}. Files can be up to ${formatSize(MAX_KNOWLEDGE_FILE_BYTES)}.` };
      }
      return { ok: true, type: type as Exclude<KnowledgeSourceType, "text">, mimeType: mimeTypes[0] };
    }
  }
  return { ok: false, message: "Upload a PDF, Markdown or TXT file." };
}

/** "12 MB", "340 KB". */
export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** A title for an uploaded file: its name without the extension. */
export function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").trim();
  return (base || fileName).slice(0, 200);
}
