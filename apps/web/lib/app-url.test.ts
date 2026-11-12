import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: vi.fn() }));

import { resolveAppUrl } from "./app-url";

const h = (o: Record<string, string>) => ({ get: (n: string) => o[n.toLowerCase()] ?? null });

describe("resolveAppUrl", () => {
  it("prefers NEXT_PUBLIC_APP_URL and drops path and trailing slash", () => {
    expect(resolveAppUrl("https://askwell.app/", h({ host: "x.vercel.app" }))).toBe("https://askwell.app");
    expect(resolveAppUrl("http://localhost:3000", h({}))).toBe("http://localhost:3000");
  });
  it("falls back to the request origin when unset or empty", () => {
    expect(resolveAppUrl(undefined, h({ host: "a-git-b.vercel.app", "x-forwarded-proto": "https" }))).toBe("https://a-git-b.vercel.app");
    expect(resolveAppUrl("", h({ host: "a.vercel.app" }))).toBe("https://a.vercel.app");
  });
  it("prefers x-forwarded-host and takes the first value", () => {
    expect(resolveAppUrl(undefined, h({ host: "internal", "x-forwarded-host": "p.vercel.app, other", "x-forwarded-proto": "https,http" }))).toBe("https://p.vercel.app");
  });
  it("uses http for localhost without a proto header", () => {
    expect(resolveAppUrl(undefined, h({ host: "localhost:3000" }))).toBe("http://localhost:3000");
  });
  it("ignores an invalid env value and uses the request", () => {
    expect(resolveAppUrl("javascript:alert(1)", h({ host: "a.vercel.app" }))).toBe("https://a.vercel.app");
    expect(resolveAppUrl("not a url", h({ host: "a.vercel.app" }))).toBe("https://a.vercel.app");
  });
  it("rejects a malformed host and returns null with no host", () => {
    expect(resolveAppUrl(undefined, h({ host: "a.com/evil\"><script>" }))).toBe("https://a.com");
    expect(resolveAppUrl(undefined, h({}))).toBeNull();
  });
});
