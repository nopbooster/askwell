import "server-only";
import OpenAI from "openai";

/** OpenAI's smallest, cheapest chat model per its model list (checked 2026-11-12). */
export const CHAT_MODEL = "gpt-6-luna";
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

/** The embeddings API takes up to 2048 inputs per request; stay well under it. */
export const EMBEDDING_BATCH_SIZE = 100;

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type TokenUsage = { inputTokens: number; outputTokens: number };
export type ChatResult = { text: string; usage: TokenUsage };

let client: OpenAI | undefined;
/** Lazy, so importing this module (or building) needs no key. */
function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  client ??= new OpenAI({ apiKey });
  return client;
}

/**
 * Embeds texts in batches, keeping the input order. One vector (1536 numbers) per text.
 * Throws on an API failure; callers decide how to surface it.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const openai = getClient();
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

/** One chat completion: a system prompt plus the conversation. Returns the text and token usage. */
export async function chatComplete({
  system,
  messages,
}: {
  system: string;
  messages: ChatMessage[];
}): Promise<ChatResult> {
  const res = await getClient().chat.completions.create({
    model: CHAT_MODEL,
    messages: [{ role: "system", content: system }, ...messages],
  });
  return {
    text: res.choices[0]?.message?.content ?? "",
    usage: {
      inputTokens: res.usage?.prompt_tokens ?? 0,
      outputTokens: res.usage?.completion_tokens ?? 0,
    },
  };
}
