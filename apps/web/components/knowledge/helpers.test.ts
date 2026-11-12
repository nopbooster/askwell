import { describe, expect, it } from "vitest";
import { MAX_KNOWLEDGE_FILE_BYTES } from "@askwell/shared";
import {
  checkFile,
  failedMessage,
  formatSize,
  hasProcessing,
  isAtSourceLimit,
  POLL_MAX_FAILURES,
  POLL_MAX_MS,
  shouldKeepPolling,
  sourceLimitLabel,
  statusView,
  titleFromFileName,
} from "./helpers";

describe("statusView", () => {
  it("shows uploading as processing (project.md §6.4)", () => {
    expect(statusView("uploading")).toBe("processing");
    expect(statusView("processing")).toBe("processing");
    expect(statusView("ready")).toBe("ready");
    expect(statusView("failed")).toBe("failed");
  });
});

describe("failedMessage", () => {
  it("says it couldn't read text from a file, and handles pasted text", () => {
    expect(failedMessage("pdf")).toContain("couldn't read text from this file");
    expect(failedMessage("text")).toContain("couldn't process this text");
  });
});

describe("source limit", () => {
  it("labels the count against the plan", () => {
    expect(sourceLimitLabel(2, "free")).toBe("2 of 3 sources on Free");
    expect(sourceLimitLabel(25, "pro")).toBe("25 of 25 sources on Pro");
  });
  it("is reached at the plan's limit", () => {
    expect(isAtSourceLimit(2, "free")).toBe(false);
    expect(isAtSourceLimit(3, "free")).toBe(true);
    expect(isAtSourceLimit(3, "pro")).toBe(false);
    expect(isAtSourceLimit(25, "pro")).toBe(true);
  });
});

describe("polling stop rule", () => {
  const processing = [{ status: "ready" as const }, { status: "uploading" as const }];
  const done = [{ status: "ready" as const }, { status: "failed" as const }];

  it("keeps polling only while something is processing", () => {
    expect(hasProcessing(processing)).toBe(true);
    expect(hasProcessing(done)).toBe(false);
    expect(hasProcessing([])).toBe(false);
    expect(shouldKeepPolling(processing, 0, 0)).toBe(true);
    expect(shouldKeepPolling(done, 0, 0)).toBe(false);
    expect(shouldKeepPolling([{ status: "processing" }], 0, 0)).toBe(true);
  });
  it("gives up after the time cap or repeated failures", () => {
    expect(shouldKeepPolling(processing, POLL_MAX_MS - 1, 0)).toBe(true);
    expect(shouldKeepPolling(processing, POLL_MAX_MS, 0)).toBe(false);
    expect(shouldKeepPolling(processing, 0, POLL_MAX_FAILURES - 1)).toBe(true);
    expect(shouldKeepPolling(processing, 0, POLL_MAX_FAILURES)).toBe(false);
  });
});

describe("checkFile", () => {
  it("accepts PDF, Markdown and TXT by extension (any case) and returns the MIME type to send", () => {
    expect(checkFile({ name: "Policy.PDF", size: 1000 })).toEqual({ ok: true, type: "pdf", mimeType: "application/pdf" });
    expect(checkFile({ name: "a.md", size: 1 })).toMatchObject({ ok: true, type: "md", mimeType: "text/markdown" });
    expect(checkFile({ name: "a.markdown", size: 1 })).toMatchObject({ ok: true, type: "md" });
    expect(checkFile({ name: "a.txt", size: 1 })).toMatchObject({ ok: true, type: "txt", mimeType: "text/plain" });
  });
  it("refuses other types", () => {
    for (const name of ["a.exe", "a.docx", "a.pdf.exe", "pdf", ""]) {
      expect(checkFile({ name, size: 10 })).toEqual({ ok: false, message: "Upload a PDF, Markdown or TXT file." });
    }
  });
  it("refuses a file over 10 MB (a 12 MB file) with the size in the message, and allows exactly 10 MB", () => {
    const big = checkFile({ name: "big.pdf", size: 12 * 1024 * 1024 });
    expect(big).toMatchObject({ ok: false });
    expect(big.ok ? "" : big.message).toBe("This file is 12 MB. Files can be up to 10 MB.");
    expect(checkFile({ name: "big.pdf", size: MAX_KNOWLEDGE_FILE_BYTES + 1 }).ok).toBe(false);
    expect(checkFile({ name: "ok.pdf", size: MAX_KNOWLEDGE_FILE_BYTES }).ok).toBe(true);
  });
  it("refuses an empty file", () => {
    expect(checkFile({ name: "a.txt", size: 0 })).toEqual({ ok: false, message: "This file is empty." });
  });
});

describe("formatSize / titleFromFileName", () => {
  it("formats sizes", () => {
    expect(formatSize(340 * 1024)).toBe("340 KB");
    expect(formatSize(10 * 1024 * 1024)).toBe("10 MB");
    expect(formatSize(1)).toBe("1 KB");
  });
  it("drops the extension and caps the length", () => {
    expect(titleFromFileName("Refund policy.pdf")).toBe("Refund policy");
    expect(titleFromFileName("notes.v2.md")).toBe("notes.v2");
    expect(titleFromFileName(".md")).toBe(".md");
    expect(titleFromFileName(`${"a".repeat(300)}.txt`)).toHaveLength(200);
  });
});
