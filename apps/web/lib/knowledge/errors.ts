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
