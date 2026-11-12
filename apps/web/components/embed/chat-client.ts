import {
  ApiErrorSchema,
  ChatResponseSchema,
  type ChatRequest,
  type ChatResponse,
} from "@askwell/shared";

/** One request in, one response out. The real client and the mock both have this shape. */
export type ChatClient = (req: ChatRequest) => Promise<ChatResponse>;

export type ChatErrorKind =
  | "rate_limited"
  | "quota_reached"
  | "blocked"
  | "generic";

/** Thrown by a chat client. `kind` picks the friendly message. */
export class ChatError extends Error {
  constructor(
    readonly kind: ChatErrorKind,
    /** HTTP status when the error came from the route (the panel reacts to 404). */
    readonly status?: number,
  ) {
    super(kind);
    this.name = "ChatError";
  }
}

export const CHAT_ERROR_MESSAGES: Record<ChatErrorKind, string> = {
  rate_limited:
    "You're sending messages very quickly. Please wait a moment and try again.",
  quota_reached:
    "This chat has reached its message limit for now. Please try again later or contact the site directly.",
  blocked: "I can't help with that request.",
  generic: "Sorry, something went wrong. Please try again.",
};

export function chatErrorMessage(error: unknown): string {
  return CHAT_ERROR_MESSAGES[
    error instanceof ChatError ? error.kind : "generic"
  ];
}

export const CHAT_ENDPOINT = "/api/widget/chat";

/** Maps a failed route response to the friendly error kind. Anything unrecognized is generic. */
export function chatErrorKindFor(status: number, code: string | undefined): ChatErrorKind {
  if (status === 429 && code === "rate_limited") return "rate_limited";
  if (status === 429 && code === "quota_exceeded") return "quota_reached";
  if (status === 400 && code === "message_blocked") return "blocked";
  return "generic";
}

/**
 * The real client: POST /api/widget/chat on the same origin as the iframe.
 * Any non-200, bad body or network failure becomes a `ChatError`; it never leaks server text.
 */
export function createChatClient(
  options: { fetchImpl?: typeof fetch; endpoint?: string } = {},
): ChatClient {
  const endpoint = options.endpoint ?? CHAT_ENDPOINT;
  return async (req) => {
    const doFetch = options.fetchImpl ?? fetch;
    let res: Response;
    try {
      res = await doFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
    } catch {
      throw new ChatError("generic");
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    if (!res.ok) {
      const error = ApiErrorSchema.safeParse(body);
      throw new ChatError(
        chatErrorKindFor(res.status, error.success ? error.data.error.code : undefined),
        res.status,
      );
    }
    const parsed = ChatResponseSchema.safeParse(body);
    if (!parsed.success) throw new ChatError("generic", res.status);
    return parsed.data;
  };
}

export const realChat: ChatClient = (req) => createChatClient()(req);

export const MOCK_DELAY_MS = 800;
export const MOCK_CONVERSATION_ID = "00000000-0000-4000-8000-000000000001";
export const MOCK_REPLY =
  "This is a demo reply. Once your documents are added, I'll answer from them.";

/** Typing one of these in the mock triggers that error state (for tests and previews). */
export const MOCK_ERROR_TRIGGERS: Record<string, ChatErrorKind> = {
  "[rate-limit]": "rate_limited",
  "[quota]": "quota_reached",
  "[error]": "generic",
};

/** Fake chat: waits ~800 ms, returns a fixed reply and a stable conversation id. */
export function createMockChat(options: { delayMs?: number } = {}): ChatClient {
  const delayMs = options.delayMs ?? MOCK_DELAY_MS;
  return async (req) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    for (const [trigger, kind] of Object.entries(MOCK_ERROR_TRIGGERS)) {
      if (req.message.includes(trigger)) throw new ChatError(kind);
    }
    return {
      conversationId: req.conversationId ?? MOCK_CONVERSATION_ID,
      reply: MOCK_REPLY,
    };
  };
}

export const mockChat: ChatClient = createMockChat();
