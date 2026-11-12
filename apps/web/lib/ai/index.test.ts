import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const embeddingsCreate = vi.fn();
const openaiCtor = vi.fn();
vi.mock("openai", () => ({
  default: class {
    embeddings = { create: embeddingsCreate };
    constructor(opts: unknown) {
      openaiCtor(opts);
    }
  },
}));
const messagesCreate = vi.fn();
const anthropicCtor = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: messagesCreate };
    constructor(opts: unknown) {
      anthropicCtor(opts);
    }
  },
}));

import {
  CHAT_MAX_TOKENS,
  CHAT_MODEL,
  EMBEDDING_BATCH_SIZE,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  chatComplete,
  embedTexts,
} from "./index";

beforeEach(() => {
  embeddingsCreate.mockReset();
  messagesCreate.mockReset();
  openaiCtor.mockClear();
  anthropicCtor.mockClear();
  process.env.OPENAI_API_KEY = "sk-test";
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
});

describe("constants", () => {
  it("names the models and dimensions", () => {
    expect(EMBEDDING_MODEL).toBe("text-embedding-3-small");
    expect(EMBEDDING_DIMENSIONS).toBe(1536);
    expect(CHAT_MODEL).toBe("claude-haiku-5-5");
  });
});

describe("embedTexts", () => {
  it("returns one vector per text in input order, even if the API reorders", async () => {
    embeddingsCreate.mockImplementation(async ({ input }: { input: string[] }) => ({
      data: input.map((t, index) => ({ index, embedding: [Number(t)] })).reverse(),
    }));
    expect(await embedTexts(["1", "2", "3"])).toEqual([[1], [2], [3]]);
    expect(embeddingsCreate).toHaveBeenCalledWith({
      model: EMBEDDING_MODEL,
      input: ["1", "2", "3"],
    });
  });
  it("batches large inputs and keeps order across batches", async () => {
    embeddingsCreate.mockImplementation(async ({ input }: { input: string[] }) => ({
      data: input.map((t, index) => ({ index, embedding: [Number(t)] })),
    }));
    const texts = Array.from({ length: EMBEDDING_BATCH_SIZE * 2 + 5 }, (_, i) => String(i));
    const out = await embedTexts(texts);
    expect(embeddingsCreate).toHaveBeenCalledTimes(3);
    expect(out.map((v) => v[0])).toEqual(texts.map(Number));
  });
  it("returns [] for no input without calling the API", async () => {
    expect(await embedTexts([])).toEqual([]);
    expect(embeddingsCreate).not.toHaveBeenCalled();
  });
  it("throws if the API returns the wrong number of embeddings", async () => {
    embeddingsCreate.mockResolvedValue({ data: [{ index: 0, embedding: [1] }] });
    await expect(embedTexts(["a", "b"])).rejects.toThrow();
  });
});

describe("chatComplete", () => {
  const reply = (content: unknown[], usage = { input_tokens: 12, output_tokens: 3 }) => ({ content, usage });

  it("returns the text and maps usage to inputTokens/outputTokens", async () => {
    messagesCreate.mockResolvedValue(reply([{ type: "text", text: "Hello!" }]));
    const out = await chatComplete({ system: "Be brief.", messages: [{ role: "user", content: "Hi" }] });
    expect(out).toEqual({ text: "Hello!", usage: { inputTokens: 12, outputTokens: 3 } });
  });
  it("puts the system prompt in `system`, never in messages, and sends the conversation as is", async () => {
    messagesCreate.mockResolvedValue(reply([{ type: "text", text: "ok" }]));
    const messages = [
      { role: "user" as const, content: "Hi" },
      { role: "assistant" as const, content: "Hello" },
      { role: "user" as const, content: "Refunds?" },
    ];
    await chatComplete({ system: "Answer only from the context.", messages });
    expect(messagesCreate).toHaveBeenCalledTimes(1);
    const body = messagesCreate.mock.calls[0]?.[0];
    expect(body).toEqual({
      model: CHAT_MODEL,
      max_tokens: CHAT_MAX_TOKENS,
      output_config: { effort: "low" },
      system: "Answer only from the context.",
      messages,
    });
    expect(body.messages.some((m: { role: string }) => m.role === "system")).toBe(false);
  });
  it("joins several text blocks and ignores thinking blocks", async () => {
    messagesCreate.mockResolvedValue(
      reply([{ type: "thinking", thinking: "hmm" }, { type: "text", text: "Part one. " }, { type: "text", text: "Part two." }]),
    );
    expect((await chatComplete({ system: "s", messages: [] })).text).toBe("Part one. Part two.");
  });
  it("returns empty text when the content is empty (e.g. a refusal)", async () => {
    messagesCreate.mockResolvedValue(reply([], { input_tokens: 5, output_tokens: 0 }));
    expect(await chatComplete({ system: "s", messages: [] })).toEqual({
      text: "",
      usage: { inputTokens: 5, outputTokens: 0 },
    });
  });
  it("uses the Anthropic key from the environment, not the OpenAI one", async () => {
    messagesCreate.mockResolvedValue(reply([]));
    vi.resetModules(); // the client is created once per module, so start from a fresh one
    const fresh = await import("./index");
    await fresh.chatComplete({ system: "s", messages: [] });
    expect(anthropicCtor).toHaveBeenCalledWith({ apiKey: "sk-ant-test" });
    expect(openaiCtor).not.toHaveBeenCalled();
  });
  it("throws a clear error without ANTHROPIC_API_KEY (and doesn't need the OpenAI key)", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    vi.resetModules();
    const fresh = await import("./index");
    await expect(fresh.chatComplete({ system: "s", messages: [] })).rejects.toThrow("ANTHROPIC_API_KEY");
    expect(messagesCreate).not.toHaveBeenCalled();
  });
  it("lets API errors through for the caller to handle", async () => {
    messagesCreate.mockRejectedValue(new Error("overloaded"));
    await expect(chatComplete({ system: "s", messages: [] })).rejects.toThrow("overloaded");
  });
});

describe("embeddings stay on OpenAI", () => {
  it("embedTexts needs OPENAI_API_KEY, not the Anthropic one", async () => {
    delete process.env.OPENAI_API_KEY;
    vi.resetModules();
    const fresh = await import("./index");
    await expect(fresh.embedTexts(["a"])).rejects.toThrow("OPENAI_API_KEY");
  });
});
