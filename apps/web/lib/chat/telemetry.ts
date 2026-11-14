import "server-only";
import { randomUUID } from "node:crypto";
import { MAX_VISITOR_ID_CHARS } from "@askwell/shared";
import { CHAT_MODEL, chatCostUsd, chatTokenPrices, type TokenUsage } from "../ai";
import { captureServer } from "../posthog/server";

/**
 * PostHog events from the widget chat route (project.md §6.6 step 1 and 7, §6.11).
 * Never send message text, replies or chunks: only IDs, counts, reasons and numbers.
 * Every function here is safe to call without PostHog configured, and never throws.
 */

export type BlockReason = "rate_limit" | "prompt_injection";

/**
 * The widget visitor's random ID (no Clerk user), or a fresh random ID when the request didn't send
 * a usable one: never one shared ID for everyone. Visitor events are personless.
 */
export function visitorDistinctId(raw: unknown): string {
  return typeof raw === "string" && raw.length > 0 && raw.length <= MAX_VISITOR_ID_CHARS ? raw : `anon_${randomUUID()}`;
}

export function messageBlockedProperties(reason: BlockReason, publicKey: string | null): Record<string, unknown> {
  return { reason, ...(publicKey ? { public_key: publicKey } : {}), $process_person_profile: false };
}

export function firstChatProperties(projectId: string, conversationId: string): Record<string, unknown> {
  return { project_id: projectId, conversation_id: conversationId };
}

export type GenerationTrace = {
  traceId: string;
  projectId: string;
  /** The conversation the reply belongs to: groups the traces of one chat (PostHog session). */
  conversationId: string | null;
  usage: TokenUsage | null;
  latencyMs: number;
  /** The error's class name when the model call failed. Never its message (it can echo input). */
  errorName: string | null;
  chunks: number;
  historyMessages: number;
};

/**
 * One `$ai_generation` event (PostHog LLM analytics, manual capture). Privacy mode: no `$ai_input`
 * or `$ai_output_choices`. Cost: PostHog computes it from the per-token prices sent here, and the
 * same number is sent as `cost_usd` for plain insights.
 */
export function generationProperties(t: GenerationTrace): Record<string, unknown> {
  const prices = t.usage ? chatTokenPrices(t.usage.inputTokens) : null;
  return {
    $ai_trace_id: t.traceId,
    $ai_session_id: t.conversationId,
    $ai_span_name: "widget_chat_reply",
    $ai_provider: "anthropic",
    $ai_model: CHAT_MODEL,
    $ai_latency: Math.round(t.latencyMs) / 1000,
    $ai_is_error: t.errorName !== null,
    ...(t.errorName !== null ? { $ai_error: t.errorName } : {}),
    ...(t.usage && prices
      ? {
          $ai_input_tokens: t.usage.inputTokens,
          $ai_output_tokens: t.usage.outputTokens,
          $ai_input_token_price: prices.input,
          $ai_output_token_price: prices.output,
          cost_usd: chatCostUsd(t.usage),
        }
      : {}),
    project_id: t.projectId,
    conversation_id: t.conversationId,
    retrieved_chunks: t.chunks,
    history_messages: t.historyMessages,
    $process_person_profile: false,
  };
}

export function trackMessageBlocked(distinctId: string, reason: BlockReason, publicKey: string | null): Promise<void> {
  return captureServer("message_blocked", distinctId, messageBlockedProperties(reason, publicKey));
}

export function trackFirstChat(distinctId: string, projectId: string, conversationId: string): Promise<void> {
  return captureServer("first_chat", distinctId, firstChatProperties(projectId, conversationId));
}

export function trackGeneration(distinctId: string, trace: GenerationTrace): Promise<void> {
  return captureServer("$ai_generation", distinctId, generationProperties(trace));
}
