import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchConversations, fetchThread } from "./api";

afterEach(() => vi.unstubAllGlobals());

const CONV = {
  id: "22222222-2222-4222-8222-222222222222",
  visitorId: "v1",
  firstMessagePreview: "Hi",
  messageCount: 2,
  createdAt: "2026-11-12T10:00:00+00:00",
};
const MSG = { id: "33333333-3333-4333-8333-333333333333", role: "visitor", body: "Hi", createdAt: "2026-11-12T10:00:00+00:00" };

describe("fetchConversations", () => {
  it("returns the parsed list, read without cache", async () => {
    const fetchMock = vi.fn(async () => Response.json({ conversations: [CONV] }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchConversations("p1")).resolves.toEqual({ ok: true, data: [CONV] });
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/p1/conversations", { cache: "no-store" });
  });
  it("fails on a bad status, a bad body or a network error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { code: "internal", message: "x" } }, { status: 500 })));
    await expect(fetchConversations("p1")).resolves.toEqual({ ok: false, notFound: false });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ conversations: [{ id: "nope" }] })));
    await expect(fetchConversations("p1")).resolves.toEqual({ ok: false, notFound: false });
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    await expect(fetchConversations("p1")).resolves.toEqual({ ok: false, notFound: false });
  });
});

describe("fetchThread", () => {
  it("returns the conversation and its messages", async () => {
    const fetchMock = vi.fn(async () => Response.json({ conversation: CONV, messages: [MSG] }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchThread(CONV.id)).resolves.toEqual({ ok: true, data: { conversation: CONV, messages: [MSG] } });
    expect(fetchMock).toHaveBeenCalledWith(`/api/conversations/${CONV.id}`, { cache: "no-store" });
  });
  it("marks a 404 as not found", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { code: "not_found", message: "x" } }, { status: 404 })));
    await expect(fetchThread(CONV.id)).resolves.toEqual({ ok: false, notFound: true });
  });
});
