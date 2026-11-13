import {
  GetConversationResponseSchema,
  ListConversationsResponseSchema,
  type ConversationSummary,
  type GetConversationResponse,
} from "@askwell/shared";

export type FetchResult<T> = { ok: true; data: T } | { ok: false; notFound: boolean };

async function getJson<T>(url: string, parse: (body: unknown) => T | null): Promise<FetchResult<T>> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return { ok: false, notFound: response.status === 404 };
    const data = parse(await response.json());
    return data === null ? { ok: false, notFound: false } : { ok: true, data };
  } catch {
    return { ok: false, notFound: false };
  }
}

/** GET /api/projects/:id/conversations: newest first (A1). */
export function fetchConversations(projectId: string): Promise<FetchResult<ConversationSummary[]>> {
  return getJson(`/api/projects/${projectId}/conversations`, (body) => {
    const parsed = ListConversationsResponseSchema.safeParse(body);
    return parsed.success ? parsed.data.conversations : null;
  });
}

/** GET /api/conversations/:id: the conversation and its messages, oldest first (A1). */
export function fetchThread(conversationId: string): Promise<FetchResult<GetConversationResponse>> {
  return getJson(`/api/conversations/${conversationId}`, (body) => {
    const parsed = GetConversationResponseSchema.safeParse(body);
    return parsed.success ? parsed.data : null;
  });
}
