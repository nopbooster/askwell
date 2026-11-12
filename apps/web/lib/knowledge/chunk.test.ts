import { describe, expect, it } from "vitest";
import { CHUNK_OVERLAP_CHARS, CHUNK_SIZE_CHARS, MAX_CHUNKS_PER_SOURCE, chunkText, normalizeText } from "./chunk";

const para = (n: number, c = "a") => `${c.repeat(n - 1)}.`;

describe("normalizeText", () => {
  it("normalizes newlines, BOM, control chars and blank runs", () => {
    expect(normalizeText("﻿a\r\nb\r\n\r\n\r\n\r\nc\u0000d  \n")).toBe("a\nb\n\ncd");
  });
  it("returns an empty string for whitespace only", () => {
    expect(normalizeText(" \n\t \r\n ")).toBe("");
  });
});

describe("chunkText", () => {
  it("returns nothing for empty or whitespace-only text", () => {
    expect(chunkText("")).toEqual({ chunks: [], truncated: false });
    expect(chunkText("  \n\n ")).toEqual({ chunks: [], truncated: false });
  });

  it("keeps short text in one chunk", () => {
    expect(chunkText("Hello world.")).toEqual({ chunks: ["Hello world."], truncated: false });
  });

  it("uses about 800 tokens (3,200 chars) with about 15% overlap by default", () => {
    expect(CHUNK_SIZE_CHARS).toBe(3200);
    expect(CHUNK_OVERLAP_CHARS / CHUNK_SIZE_CHARS).toBeCloseTo(0.15, 2);
  });

  it("never exceeds the chunk size and always makes progress", () => {
    const text = Array.from({ length: 400 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
    const { chunks } = chunkText(text, { size: 500, overlap: 75 });
    expect(chunks.length).toBeGreaterThan(5);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(500);
  });

  it("prefers paragraph breaks", () => {
    const text = `${para(300)}\n\n${para(300, "b")}\n\n${para(300, "c")}`;
    const { chunks } = chunkText(text, { size: 700, overlap: 50 });
    expect(chunks[0]).toBe(`${para(300)}\n\n${para(300, "b")}`);
  });

  it("falls back to sentence breaks", () => {
    const text = Array.from({ length: 30 }, (_, i) => `This is sentence ${i}.`).join(" ");
    const { chunks } = chunkText(text, { size: 200, overlap: 20 });
    for (const c of chunks.slice(0, -1)) expect(c).toMatch(/\.$/);
  });

  it("falls back to word breaks, never starting a chunk mid-word", () => {
    const text = Array.from({ length: 200 }, (_, i) => `word${i}`).join(" ");
    const { chunks } = chunkText(text, { size: 100, overlap: 20 });
    for (const c of chunks) expect(c).toMatch(/^word\d+/);
  });

  it("hard-cuts text with no break at all, and still ends", () => {
    const { chunks } = chunkText("x".repeat(1000), { size: 100, overlap: 10 });
    expect(chunks.length).toBeGreaterThanOrEqual(10);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(100);
  });

  it("overlaps consecutive chunks", () => {
    const text = Array.from({ length: 300 }, (_, i) => `w${i}`).join(" ");
    const { chunks } = chunkText(text, { size: 400, overlap: 60 });
    for (let i = 1; i < chunks.length; i++) {
      const lastWords = (chunks[i - 1] ?? "").split(" ").slice(-3);
      expect(chunks[i]).toContain(lastWords.join(" ").slice(-6));
    }
  });

  it("covers the whole text: every word appears in some chunk", () => {
    const words = Array.from({ length: 500 }, (_, i) => `t${i}`);
    const { chunks } = chunkText(words.join(" "), { size: 300, overlap: 40 });
    const joined = chunks.join(" ");
    for (const w of words) expect(joined).toContain(w);
  });

  it("caps the number of chunks and reports truncation", () => {
    const text = "word ".repeat(20_000);
    const r = chunkText(text, { size: 100, overlap: 10, maxChunks: 7 });
    expect(r.chunks).toHaveLength(7);
    expect(r.truncated).toBe(true);
  });

  it("is not truncated at exactly the cap", () => {
    const r = chunkText("a. ".repeat(10), { size: 3200, maxChunks: 1 });
    expect(r.chunks).toHaveLength(1);
    expect(r.truncated).toBe(false);
  });

  it("the default cap is 400 chunks", () => {
    expect(MAX_CHUNKS_PER_SOURCE).toBe(400);
    const r = chunkText("word ".repeat(500_000));
    expect(r.chunks).toHaveLength(400);
    expect(r.truncated).toBe(true);
  });

  it("rejects impossible options", () => {
    expect(() => chunkText("x", { size: 100, overlap: 60 })).toThrow(RangeError);
    expect(() => chunkText("x", { maxChunks: 0 })).toThrow(RangeError);
  });

  it("drops empty chunks", () => {
    const { chunks } = chunkText(`a.\n\n\n\n\n\n${"b".repeat(50)}`, { size: 20, overlap: 2 });
    for (const c of chunks) expect(c.trim()).not.toBe("");
  });
});
