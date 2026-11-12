import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: (handler: unknown) => handler,
}));

import { config } from "./proxy";

const [pageMatcher, apiMatcher] = config.matcher.map((m) => new RegExp(`^${m}$`));
const runs = (path: string) => Boolean(pageMatcher?.test(path) || apiMatcher?.test(path));

describe("proxy matcher", () => {
  it("does not run Clerk on /embed", () => {
    expect(runs("/embed")).toBe(false);
    expect(runs("/embed/abc")).toBe(false);
  });
  it("keeps /api/widget/* and other routes running (public via handler)", () => {
    expect(runs("/api/widget/config")).toBe(true);
    expect(runs("/dashboard")).toBe(true);
    expect(runs("/api/projects")).toBe(true);
    expect(runs("/embedded-docs")).toBe(true);
    expect(runs("/")).toBe(true);
  });
  it("skips Next internals", () => {
    expect(runs("/_next/static/x")).toBe(false);
  });
});
