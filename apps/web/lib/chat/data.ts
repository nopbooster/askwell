import "server-only";
import type { Plan } from "@askwell/shared";
import { createServiceClient } from "../supabase/service";
import { HISTORY_LIMIT } from "./prompt";
import type { ChatMessage } from "../ai";

/** Everything below runs with the service client, only after the route has resolved the project by key. */

export type ChatProject = { id: string; plan: Plan };

/** Resolves a project by its public key. `null` when unknown. The plan is read here, on the server. */
export async function findProjectByKey(publicKey: string): Promise<ChatProject | null> {
  const { data, error } = await createServiceClient()
    .from("projects")
    .select("id, accounts(plan)")
    .eq("public_key", publicKey)
    .maybeSingle();
  if (error) throw new Error(`findProjectByKey: read failed (${error.message})`);
  if (!data) return null;
  return { id: data.id, plan: data.accounts?.plan === "pro" ? "pro" : "free" };
}

/** Does this conversation belong to this project? */
export async function conversationBelongsToProject(conversationId: string, projectId: string): Promise<boolean> {
  const { data, error } = await createServiceClient()
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw new Error(`conversationBelongsToProject: read failed (${error.message})`);
  return data !== null;
}

/** Counts one message. `allowed: false` means the plan's monthly limit is reached. */
export async function consumeMessage(projectId: string, limit: number): Promise<boolean> {
  const { data, error } = await createServiceClient().rpc("consume_message", {
    p_project_id: projectId,
    p_limit: limit,
  });
  if (error) throw new Error(`consumeMessage: rpc failed (${error.message})`);
  return data?.[0]?.allowed === true;
}

/** Top matching chunk texts of `ready` sources in this project only. */
export async function matchChunks(projectId: string, embedding: number[], count: number): Promise<string[]> {
  const { data, error } = await createServiceClient().rpc("match_chunks", {
    p_project_id: projectId,
    p_embedding: JSON.stringify(embedding),
    p_match_count: count,
  });
  if (error) throw new Error(`matchChunks: rpc failed (${error.message})`);
  return (data ?? []).map((row) => row.content);
}

/** The last `HISTORY_LIMIT` messages of a conversation, oldest first. Call only after the ownership check. */
export async function loadHistory(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await createServiceClient()
    .from("messages")
    .select("role, body")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw new Error(`loadHistory: read failed (${error.message})`);
  return (data ?? [])
    .slice(0, HISTORY_LIMIT)
    .reverse()
    .map((m) => ({ role: m.role === "bot" ? "assistant" : "user", content: m.body }));
}

/** Saves the visitor message and bot reply; creates the conversation when `conversationId` is null. */
export async function saveChatTurn(args: {
  projectId: string;
  conversationId: string | null;
  visitorId: string;
  message: string;
  reply: string;
}): Promise<string> {
  const { data, error } = await createServiceClient().rpc("save_chat_turn", {
    p_project_id: args.projectId,
    p_conversation_id: args.conversationId as string,
    p_visitor_id: args.visitorId,
    p_visitor_message: args.message,
    p_bot_reply: args.reply,
  });
  if (error || !data) throw new Error(`saveChatTurn: rpc failed (${error?.message ?? "no id"})`);
  return data;
}
