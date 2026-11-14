import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

/** The headers next.config sets for one request path (exact `source` match). */
async function headersFor(source: string): Promise<Record<string, string>> {
  const rules = (await nextConfig.headers?.()) ?? [];
  const rule = rules.find((r) => r.source === source);
  if (!rule) throw new Error(`no header rule for ${source}`);
  return Object.fromEntries(rule.headers.map((h) => [h.key.toLowerCase(), h.value]));
}

describe("/widget.js headers", () => {
  it("lets browsers cache the loader for 5 minutes only, so a fix reaches customer sites quickly", async () => {
    const headers = await headersFor("/widget.js");
    expect(headers["cache-control"]).toBe("public, max-age=300");
  });
  it("never marks the loader immutable or long-lived (its URL never changes between deploys)", async () => {
    const value = (await headersFor("/widget.js"))["cache-control"] ?? "";
    expect(value).not.toMatch(/immutable/);
    const maxAge = Number(/max-age=(\d+)/.exec(value)?.[1]);
    expect(maxAge).toBeLessThanOrEqual(300);
  });
});
