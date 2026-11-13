import { describe, expect, it } from "vitest";
import type { GetConversationResponse } from "@askwell/shared";
import { nextThreadState, threadWhileRefreshing, type ThreadState } from "./state";

const thread = (n: number): GetConversationResponse => ({
  conversation: { id: "a", visitorId: "v", firstMessagePreview: "Hi", messageCount: n, createdAt: "2026-11-12T10:00:00Z" },
  messages: [],
});
const ready: ThreadState = { status: "ready", id: "a", thread: thread(1) };

describe("threadWhileRefreshing", () => {
  it("keeps a loaded thread on screen during a refresh", () => {
    expect(threadWhileRefreshing(ready, "a")).toBe(ready);
  });
  it("shows loading for a different thread or one that isn't loaded", () => {
    expect(threadWhileRefreshing(ready, "b")).toEqual({ status: "loading", id: "b" });
    expect(threadWhileRefreshing({ status: "error", id: "a" }, "a")).toEqual({ status: "loading", id: "a" });
  });
});

describe("nextThreadState", () => {
  it("shows the new thread on success (a refresh picks up new messages)", () => {
    expect(nextThreadState(ready, "a", { ok: true, data: thread(3) }, true)).toEqual({ status: "ready", id: "a", thread: thread(3) });
  });
  it("keeps the thread on screen when a refresh fails", () => {
    expect(nextThreadState(ready, "a", { ok: false, notFound: false }, true)).toBe(ready);
  });
  it("shows an error when a first load fails", () => {
    expect(nextThreadState({ status: "loading", id: "a" }, "a", { ok: false, notFound: false }, false)).toEqual({ status: "error", id: "a" });
    expect(nextThreadState(ready, "a", { ok: false, notFound: false }, false)).toEqual({ status: "error", id: "a" });
  });
  it("shows missing on a 404, even during a refresh", () => {
    expect(nextThreadState(ready, "a", { ok: false, notFound: true }, true)).toEqual({ status: "missing", id: "a" });
  });
});
