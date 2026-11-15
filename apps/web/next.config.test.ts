import { describe, expect, it } from "vitest";
// Next's own matcher for `headers()` sources, so the tests check what Next actually applies.
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import nextConfig, { ALL_PATHS_SOURCE, NOT_EMBED_SOURCE } from "./next.config";

/** Every header next.config adds to a request for `path` (later rules win, like Next). */
async function headersFor(path: string): Promise<Record<string, string>> {
  const rules = (await nextConfig.headers?.()) ?? [];
  const out: Record<string, string> = {};
  for (const rule of rules) {
    const match = getPathMatch(rule.source, { strict: true, removeUnnamedParams: true });
    if (match(path)) for (const h of rule.headers) out[h.key.toLowerCase()] = h.value;
  }
  return out;
}

const PAGES_AND_APIS = ["/", "/dashboard", "/dashboard/p/abc/usage", "/sign-in", "/sign-up", "/api/projects", "/api/widget/chat", "/embedded-docs"];
const EMBED = ["/embed", "/embed/", "/embed/anything"];

describe("clickjacking (project.md §9): only /embed may be framed by other sites", () => {
  it.each(PAGES_AND_APIS)("%s sends frame-ancestors 'self'", async (path) => {
    expect((await headersFor(path))["content-security-policy"]).toBe("frame-ancestors 'self'");
  });
  it.each(EMBED)("%s can be framed by any site: no frame-ancestors, no X-Frame-Options", async (path) => {
    const headers = await headersFor(path);
    expect(headers).not.toHaveProperty("content-security-policy");
    expect(headers).not.toHaveProperty("x-frame-options");
  });
  it("never sends X-Frame-Options (it can't exempt /embed)", async () => {
    for (const path of [...PAGES_AND_APIS, ...EMBED, "/widget.js"]) {
      expect(await headersFor(path)).not.toHaveProperty("x-frame-options");
    }
  });
  it("is not a full CSP (that would break Clerk, Stripe and PostHog)", async () => {
    expect((await headersFor("/dashboard"))["content-security-policy"]).not.toMatch(/default-src|script-src|connect-src/);
  });
  it("uses the sources the build manifest was checked against", () => {
    expect(NOT_EMBED_SOURCE).toBe("/:path((?!embed(?:/|$)).*)");
    expect(ALL_PATHS_SOURCE).toBe("/(.*)");
  });
});

describe("headers on every path", () => {
  it.each([...PAGES_AND_APIS, ...EMBED, "/widget.js"])("%s: nosniff and a strict referrer policy", async (path) => {
    const headers = await headersFor(path);
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });
});

describe("/widget.js headers", () => {
  it("lets browsers cache the loader for 5 minutes only, so a fix reaches customer sites quickly", async () => {
    expect((await headersFor("/widget.js"))["cache-control"]).toBe("public, max-age=300");
  });
  it("never marks the loader immutable or long-lived (its URL never changes between deploys)", async () => {
    const value = (await headersFor("/widget.js"))["cache-control"] ?? "";
    expect(value).not.toMatch(/immutable/);
    expect(Number(/max-age=(\d+)/.exec(value)?.[1])).toBeLessThanOrEqual(300);
  });
  it("only /widget.js gets that Cache-Control", async () => {
    expect(await headersFor("/dashboard")).not.toHaveProperty("cache-control");
  });
});
