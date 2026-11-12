import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const embeddingsCreate = vi.fn();
const chatCreate = vi.fn();
const ctor = vi.fn();
vi.mock("openai", () => ({
  default: class {
    embeddings = { create: embeddingsCreate };
    chat = { completions: { create: chatCreate } };
    constructor(opts: unknown) {
      ctor(opts);
    }
  },
}));

import {
  CHAT_MODEL,
  EMBEDDING_BATCH_SIZE,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  chatComplete,
  embedTexts,
} from "./index";

beforeEach(() => {
  embeddingsCreate.mockReset();
  chatCreate.mockReset();
  process.env.OPENAI_API_KEY = "sk-test";
});

describe("constants", () => {
  it("names the models and dimensions", () => {
    expect(EMBEDDING_MODEL).toBe("text-embedding-3-small");
    expect(EMBEDDING_DIMENSIONS).toBe(1536);
    expect(CHAT_MODEL).toBeTruthy();
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
  it("sends system + messages and returns text and token usage", async () => {
    chatCreate.mockResolvedValue({
      choices: [{ message: { content: "Hello!" } }],
      usage: { prompt_tokens: 12, completion_tokens: 3 },
    });
    const out = await chatComplete({
      system: "Be brief.",
      messages: [{ role: "user", content: "Hi" }],
    });
    expect(out).toEqual({ text: "Hello!", usage: { inputTokens: 12, outputTokens: 3 } });
    expect(chatCreate).toHaveBeenCalledWith({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: "Be brief." },
        { role: "user", content: "Hi" },
      ],
    });
  });
  it("returns empty text and zero usage when the API omits them", async () => {
    chatCreate.mockResolvedValue({ choices: [] });
    expect(await chatComplete({ system: "s", messages: [] })).toEqual({
      text: "",
      usage: { inputTokens: 0, outputTokens: 0 },
    });
  });
  it("throws a clear error without a key", async () => {
    delete process.env.OPENAI_API_KEY;
    vi.resetModules();
    const fresh = await import("./index");
    await expect(fresh.chatComplete({ system: "s", messages: [] })).rejects.toThrow(
      "OPENAI_API_KEY",
    );
  });
});
