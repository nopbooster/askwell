import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ExtractionError, NoTextError } from "./errors";
import { extractText, isPdf } from "./extract";

const here = dirname(fileURLToPath(import.meta.url));
const pdf = new Uint8Array(readFileSync(join(here, "__fixtures__/refund-policy.pdf")));
const enc = (s: string) => new TextEncoder().encode(s);

describe("isPdf", () => {
  it("checks the %PDF- magic bytes", () => {
    expect(isPdf(pdf)).toBe(true);
    expect(isPdf(enc("%PDF-1.7\n"))).toBe(true);
    expect(isPdf(enc("%PDF"))).toBe(false);
    expect(isPdf(enc("<html>%PDF-"))).toBe(false);
    expect(isPdf(enc("MZ\u0090\u0000"))).toBe(false);
    expect(isPdf(new Uint8Array())).toBe(false);
  });
});

describe("extractText", () => {
  it("extracts the text of a real PDF", async () => {
    const text = await extractText("pdf", pdf);
    expect(text).toContain("refunds are available within 30 days");
  });

  it("does not detach or change the caller's bytes", async () => {
    const copy = new Uint8Array(pdf);
    await extractText("pdf", copy);
    expect(copy.byteLength).toBe(pdf.byteLength);
  });

  it("rejects bytes that aren't a PDF", async () => {
    await expect(extractText("pdf", enc("hello"))).rejects.toBeInstanceOf(ExtractionError);
  });

  it("rejects a corrupt PDF", async () => {
    await expect(extractText("pdf", enc("%PDF-1.4\nnot really a pdf"))).rejects.toBeInstanceOf(ExtractionError);
  });

  it("decodes TXT and MD as UTF-8 and normalizes", async () => {
    expect(await extractText("txt", enc("﻿Café\r\nnaïve"))).toBe("Café\nnaïve");
    expect(await extractText("md", enc("# Title\n\nBody *text*"))).toBe("# Title\n\nBody *text*");
  });

  it("throws NoTextError for empty or whitespace-only text", async () => {
    await expect(extractText("txt", enc(""))).rejects.toBeInstanceOf(NoTextError);
    await expect(extractText("md", enc(" \n\t\n"))).rejects.toBeInstanceOf(NoTextError);
  });

  it("throws NoTextError for a PDF without text", async () => {
    const blank = new TextDecoder().decode(pdf).replace(/BT .*? ET/, "");
    await expect(extractText("pdf", enc(blank))).rejects.toBeInstanceOf(NoTextError);
  });

  it("rejects invalid UTF-8", async () => {
    await expect(extractText("txt", new Uint8Array([0xff, 0xfe, 0xfd]))).rejects.toBeInstanceOf(ExtractionError);
  });
});
