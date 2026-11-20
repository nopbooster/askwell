/** The file parsed but holds no text (e.g. a scanned PDF, or an empty file). */
export class NoTextError extends Error {
  readonly code = "no_text";
  constructor() {
    super("The file contains no extractable text.");
    this.name = "NoTextError";
  }
}

/** The bytes aren't a readable file of the declared type. */
export class ExtractionError extends Error {
  readonly code = "unreadable";
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ExtractionError";
  }
}

/** Longest error message we log. Provider messages are short; this keeps an odd one from flooding the logs. */
export const MAX_LOGGED_ERROR_CHARS = 300;

/**
 * What a log line may say about an error: its name and message, nothing else (no stack, cause or
 * request payload, which could carry the pasted text). Anything that looks like an API key (`sk-…`;
 * OpenAI echoes a masked one on a 401) is redacted. The message is capped at `MAX_LOGGED_ERROR_CHARS`.
 */
export function describeError(error: unknown): { name: string; message: string } {
  const name = error instanceof Error ? error.name : typeof error;
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const redacted = raw.replace(/\bsk-[A-Za-z0-9_*-]+/g, "sk-[redacted]");
  const message =
    redacted.length > MAX_LOGGED_ERROR_CHARS ? `${redacted.slice(0, MAX_LOGGED_ERROR_CHARS)}…` : redacted;
  return { name, message };
}
