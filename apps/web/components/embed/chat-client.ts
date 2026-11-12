import type { ChatRequest, ChatResponse } from "@askwell/shared";

/** What Phase 3's real client will look like too: one request in, one response out. */
export type ChatClient = (req: ChatRequest) => Promise<ChatResponse>;

export type ChatErrorKind = "rate_limited" | "quota_reached" | "generic";

/** Thrown by a chat client. `kind` picks the friendly message. */
export class ChatError extends Error {
  constructor(readonly kind: ChatErrorKind) {
    super(kind);
    this.name = "ChatError";
  }
}

export const CHAT_ERROR_MESSAGES: Record<ChatErrorKind, string> = {
  rate_limited:
    "You're sending messages very quickly. Please wait a moment and try again.",
  quota_reached:
    "This chat has reached its message limit for now. Please try again later or contact the site directly.",
  generic: "Sorry, something went wrong. Please try again.",
};

export function chatErrorMessage(error: unknown): string {
  return CHAT_ERROR_MESSAGES[
    error instanceof ChatError ? error.kind : "generic"
  ];
}

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
