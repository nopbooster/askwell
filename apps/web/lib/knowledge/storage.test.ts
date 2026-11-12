import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { ServiceClient } from "../supabase/service";
import { knowledgeFileKind, removeKnowledgeFiles, removeProjectFiles } from "./storage";

describe("knowledgeFileKind", () => {
  it("maps extensions to a type, case-insensitively", () => {
    expect(knowledgeFileKind("Policy.PDF")).toEqual({ type: "pdf", ext: ".pdf" });
    expect(knowledgeFileKind("notes.md")).toEqual({ type: "md", ext: ".md" });
    expect(knowledgeFileKind("notes.markdown")).toEqual({ type: "md", ext: ".markdown" });
    expect(knowledgeFileKind("a.txt")).toEqual({ type: "txt", ext: ".txt" });
  });
  it("returns null for anything else", () => {
    for (const name of ["a.exe", "a.pdf.exe", "pdf", "", "a.docx"]) expect(knowledgeFileKind(name)).toBeNull();
  });
});

function fakeDb(list: ReturnType<typeof vi.fn>, remove: ReturnType<typeof vi.fn>) {
  return { storage: { from: () => ({ list, remove }) } } as unknown as ServiceClient;
}

describe("removeKnowledgeFiles", () => {
  it("does nothing for no keys, and throws on a Storage error", async () => {
    const remove = vi.fn().mockResolvedValue({ error: { message: "down" } });
    await removeKnowledgeFiles(fakeDb(vi.fn(), remove), []);
    expect(remove).not.toHaveBeenCalled();
    await expect(removeKnowledgeFiles(fakeDb(vi.fn(), remove), ["a"])).rejects.toThrow("down");
  });
});

describe("removeProjectFiles", () => {
  it("lists and removes page after page until the folder is empty", async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ name: "a.pdf" }], error: null })
      .mockResolvedValueOnce({ data: [{ name: "b.txt" }], error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    await removeProjectFiles(fakeDb(list, remove), "p1");
    expect(list).toHaveBeenCalledTimes(3);
    expect(remove.mock.calls).toEqual([[["p1/a.pdf"]], [["p1/b.txt"]]]);
  });
  it("throws when listing fails", async () => {
    const list = vi.fn().mockResolvedValue({ data: null, error: { message: "nope" } });
    await expect(removeProjectFiles(fakeDb(list, vi.fn()), "p1")).rejects.toThrow("nope");
  });
  it("throws instead of looping forever when files never go away", async () => {
    const list = vi.fn().mockResolvedValue({ data: [{ name: "stuck" }], error: null });
    await expect(removeProjectFiles(fakeDb(list, vi.fn().mockResolvedValue({ error: null })), "p1")).rejects.toThrow("too many");
  });
});
