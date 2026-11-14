import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

/** Chat replies use Claude (Anthropic): the small, cheap Haiku. Embeddings stay on OpenAI. */
export const CHAT_MODEL = "claude-haiku-5-5";
/** Replies are short. This also caps the cost of one reply (thinking tokens count toward it). */
export const CHAT_MAX_TOKENS = 1024;
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

/** The embeddings API takes up to 2048 inputs per request; stay well under it. */
export const EMBEDDING_BATCH_SIZE = 100;

/**
 * Claude Haiku 5.5 list prices in USD per token (Anthropic API, 2026-11). Prompts over
 * `CHAT_LONG_PROMPT_TOKENS` input tokens are billed at the higher rate for the whole request.
 * Sent with each AI trace so PostHog shows a cost even if it doesn't know the model yet.
 */
export const CHAT_PRICES = {
  input: 0.1 / 1_000_000,
  output: 0.5 / 1_000_000,
  longInput: 0.5 / 1_000_000,
  longOutput: 2.5 / 1_000_000,
} as const;
export const CHAT_LONG_PROMPT_TOKENS = 100_000;

/** Per-token prices for one chat call, by its input size. */
export function chatTokenPrices(inputTokens: number): { input: number; output: number } {
  return inputTokens > CHAT_LONG_PROMPT_TOKENS
    ? { input: CHAT_PRICES.longInput, output: CHAT_PRICES.longOutput }
    : { input: CHAT_PRICES.input, output: CHAT_PRICES.output };
}

/** The cost of one chat call in USD. */
export function chatCostUsd(usage: TokenUsage): number {
  const price = chatTokenPrices(usage.inputTokens);
  return usage.inputTokens * price.input + usage.outputTokens * price.output;
}

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type TokenUsage = { inputTokens: number; outputTokens: number };
export type ChatResult = { text: string; usage: TokenUsage };

let openaiClient: OpenAI | undefined;
/** Embeddings only. Lazy, so importing this module (or building) needs no key. */
function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  openaiClient ??= new OpenAI({ apiKey });
  return openaiClient;
}

let anthropicClient: Anthropic | undefined;
/** Chat only. Lazy like the OpenAI client; the key is server-only (never `NEXT_PUBLIC_*`). */
function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  anthropicClient ??= new Anthropic({ apiKey });
  return anthropicClient;
}

/**
 * Embeds texts in batches, keeping the input order. One vector (1536 numbers) per text.
 * Throws on an API failure; callers decide how to surface it.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const openai = getOpenAI();
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: batch });
    // The API returns an index per item; sort so order never depends on response order.
    const sorted = [...res.data].sort((a, b) => a.index - b.index);
    if (sorted.length !== batch.length)
      throw new Error("embedTexts: unexpected number of embeddings");
    for (const item of sorted) vectors.push(item.embedding);
  }
  return vectors;
}

/**
 * One chat completion with Claude: a system prompt plus the conversation. Returns the text and token usage.
 * The system prompt goes in the `system` field, not in `messages`. Low effort keeps short replies cheap and fast.
 */
export async function chatComplete({
  system,
  messages,
}: {
  system: string;
  messages: ChatMessage[];
}): Promise<ChatResult> {
  const res = await getAnthropic().messages.create({
    model: CHAT_MODEL,
    max_tokens: CHAT_MAX_TOKENS,
    output_config: { effort: "low" },
    system,
    messages,
  });
  // Only text blocks are the reply (a thinking block, if any, is never shown). A refusal has no text.
  const text = res.content.map((block) => (block.type === "text" ? block.text : "")).join("");
  // A reply cut off at the token cap is still returned (a partial answer beats none), but we log it (never its text).
  if (res.stop_reason === "max_tokens")
    console.warn("[ai] chat reply hit max_tokens", { model: CHAT_MODEL, outputTokens: res.usage.output_tokens });
  return {
    text,
    usage: { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens },
  };
}
