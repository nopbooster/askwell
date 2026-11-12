export const MAX_KNOWLEDGE_FILE_BYTES = 10 * 1024 * 1024;

export const KNOWLEDGE_FILE_TYPES = {
  pdf: { extensions: [".pdf"], mimeTypes: ["application/pdf"] },
  md: { extensions: [".md", ".markdown"], mimeTypes: ["text/markdown", "text/x-markdown"] },
  txt: { extensions: [".txt"], mimeTypes: ["text/plain"] },
} as const;

export const KNOWLEDGE_FILE_EXTENSIONS: readonly string[] = Object.values(
  KNOWLEDGE_FILE_TYPES,
).flatMap((t) => t.extensions);

export const KNOWLEDGE_FILE_MIME_TYPES: readonly string[] = Object.values(
  KNOWLEDGE_FILE_TYPES,
).flatMap((t) => t.mimeTypes);

export const MAX_MESSAGE_CHARS = 1000;
export const CHAT_RATE_LIMIT = { max: 20, windowSeconds: 60 } as const;
export const RETRIEVAL_TOP_K = 5;
export const EMBEDDING_DIMENSIONS = 1536;

export const PUBLIC_KEY_PREFIX = "pk_";
/** `pk_` followed by 16+ URL-safe characters. */
export const PUBLIC_KEY_REGEX = /^pk_[A-Za-z0-9_-]{16,}$/;

export const MAX_PROJECT_NAME_CHARS = 100;
export const MAX_KNOWLEDGE_TITLE_CHARS = 200;
/** Cap for pasted knowledge text. */
export const MAX_KNOWLEDGE_TEXT_CHARS = 200_000;
export const MAX_WIDGET_LABEL_CHARS = 40;
export const MAX_WIDGET_HEADER_CHARS = 60;
export const MAX_VISITOR_ID_CHARS = 64;
