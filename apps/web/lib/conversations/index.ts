import "server-only";
import type { ChatMessage, ConversationSummary, MessageRole } from "@askwell/shared";
import { createOwnerClient } from "../supabase/owner";

/** The list shows the newest conversations only: no pagination (project.md §6.7). */
export const CONVERSATION_LIST_LIMIT = 50;
/** Longest preview of the first visitor message, in characters, before the ellipsis. */
export const PREVIEW_MAX_CHARS = 120;

/**
 * The first visitor message as a one-line preview: whitespace collapsed, cut at `PREVIEW_MAX_CHARS`
 * characters (never inside a surrogate pair) with "…" appended when cut. Plain text, never HTML.
 */
export function toPreview(body: string | null | undefined): string {
  const text = (body ?? "").replace(/\s+/g, " ").trim();
  const chars = Array.from(text);
  if (chars.length <= PREVIEW_MAX_CHARS) return text;
  return `${chars.slice(0, PREVIEW_MAX_CHARS).join("").trimEnd()}…`;
}

/** One list row as the owner client returns it: the count and first visitor message are embedded. */
export type ConversationListRow = {
  id: string;
  visitor_id: string;
  created_at: string;
  message_count: { count: number }[];
  first_visitor: { body: string }[];
};

export function toConversationSummary(row: ConversationListRow): ConversationSummary {
  return {
    id: row.id,
    visitorId: row.visitor_id,
    firstMessagePreview: toPreview(row.first_visitor[0]?.body),
    messageCount: row.message_count[0]?.count ?? 0,
    createdAt: row.created_at,
  };
}

/**
 * A project's conversations, newest first, at most `CONVERSATION_LIST_LIMIT`. Owner client, so RLS
 * scopes the rows. Call after `getOwnedProject` (another owner's project must be a 404, not an empty
 * list). One query: `message_count` is the embedded row count and `first_visitor` the oldest visitor
 * message. Throws on a database error.
 */
export async function listProjectConversations(projectId: string): Promise<ConversationSummary[]> {
  const { data, error } = await (await createOwnerClient())
    .from("conversations")
    .select("id, visitor_id, created_at, message_count:messages(count), first_visitor:messages(body)")
    .eq("project_id", projectId)
    .eq("first_visitor.role", "visitor")
    .order("created_at", { referencedTable: "first_visitor", ascending: true })
    .limit(1, { referencedTable: "first_visitor" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(CONVERSATION_LIST_LIMIT);
  if (error) throw new Error(`listProjectConversations: read failed (${error.message})`);
  return data.map(toConversationSummary);
}

type MessageRow = { id: string; role: string; body: string; created_at: string };

export function toChatMessage(row: MessageRow): ChatMessage {
  return { id: row.id, role: row.role as MessageRole, body: row.body, createdAt: row.created_at };
}

/**
 * One conversation and all its messages, oldest first, or `null` when it doesn't exist or isn't the
 * caller's (RLS makes both look the same). Owner client only. Throws on a database error.
 */
export async function getConversationThread(
  conversationId: string,
): Promise<{ conversation: ConversationSummary; messages: ChatMessage[] } | null> {
  const db = await createOwnerClient();
  const { data: conversation, error } = await db
    .from("conversations")
    .select("id, visitor_id, created_at")
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw new Error(`getConversationThread: conversation read failed (${error.message})`);
  if (!conversation) return null;

  const { data: rows, error: messagesError } = await db
    .from("messages")
    .select("id, role, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (messagesError) throw new Error(`getConversationThread: messages read failed (${messagesError.message})`);

  const messages = rows.map(toChatMessage);
  return {
    conversation: {
      id: conversation.id,
      visitorId: conversation.visitor_id,
      firstMessagePreview: toPreview(messages.find((m) => m.role === "visitor")?.body),
      messageCount: messages.length,
      createdAt: conversation.created_at,
    },
    messages,
  };
}
