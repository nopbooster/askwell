import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSources, uploadToSignedUrl } from "./api";

afterEach(() => vi.unstubAllGlobals());

const SOURCE = { id: "22222222-2222-4222-8222-222222222222", title: "FAQ", type: "text", status: "ready", createdAt: "2026-11-12T10:00:00+00:00" };

describe("fetchSources", () => {
  it("returns the parsed list", async () => {
    const fetchMock = vi.fn(async () => Response.json({ sources: [SOURCE] }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchSources("p1")).resolves.toEqual([SOURCE]);
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/p1/knowledge", { cache: "no-store" });
  });
  it("returns null on a bad status, a bad body or a network error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { code: "internal", message: "x" } }, { status: 500 })));
    await expect(fetchSources("p1")).resolves.toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ nope: 1 })));
    await expect(fetchSources("p1")).resolves.toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    await expect(fetchSources("p1")).resolves.toBeNull();
  });
});

class FakeXhr {
  static last: FakeXhr;
  upload: { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 200;
  method = "";
  url = "";
  headers: Record<string, string> = {};
  body: FormData | null = null;
  constructor() {
    FakeXhr.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(k: string, v: string) {
    this.headers[k] = v;
  }
  send(body: FormData) {
    this.body = body;
  }
}

describe("uploadToSignedUrl", () => {
  const file = new File(["%PDF-1.4"], "policy.pdf", { type: "" });

  it("PUTs multipart straight to the signed URL, with the checked MIME type, and reports progress", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const progress = vi.fn();
    const result = uploadToSignedUrl("https://storage.example/upload?token=t", file, "application/pdf", progress);
    const xhr = FakeXhr.last;
    expect(xhr.method).toBe("PUT");
    expect(xhr.url).toBe("https://storage.example/upload?token=t");
    expect(xhr.headers["x-upsert"]).toBe("false");
    const sent = xhr.body?.get("") as File;
    expect(sent.type).toBe("application/pdf");
    expect(sent.name).toBe("policy.pdf");
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 });
    expect(progress).toHaveBeenCalledWith(0.5);
    xhr.onload?.();
    await expect(result).resolves.toEqual({ ok: true });
  });

  it("resolves { ok: false } on an error status, a network error or an abort", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    let p = uploadToSignedUrl("https://s/u", file, "application/pdf", vi.fn());
    FakeXhr.last.status = 403;
    FakeXhr.last.onload?.();
    await expect(p).resolves.toEqual({ ok: false });
    p = uploadToSignedUrl("https://s/u", file, "application/pdf", vi.fn());
    FakeXhr.last.onerror?.();
    await expect(p).resolves.toEqual({ ok: false });
    p = uploadToSignedUrl("https://s/u", file, "application/pdf", vi.fn());
    FakeXhr.last.onabort?.();
    await expect(p).resolves.toEqual({ ok: false });
  });
});
