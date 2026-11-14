import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: (handler: unknown) => handler,
}));

import handler, { config } from "./proxy";

type Handler = (auth: unknown, req: { nextUrl: URL }) => Promise<unknown>;
/** Runs the proxy for `path` with no Clerk session; returns the result and whether it tried to protect. */
async function runSignedOut(path: string) {
  const protect = vi.fn(async () => {
    throw new Error("auth.protect() redirected");
  });
  const auth = Object.assign(vi.fn(async () => ({ isAuthenticated: false })), { protect });
  const result = await (handler as unknown as Handler)(auth, { nextUrl: new URL(`https://app.test${path}`) });
  return { result, protect };
}

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

describe("proxy handler without a Clerk session", () => {
  it("lets the Clerk webhook through: no 401, no auth.protect()", async () => {
    expect(runs("/api/clerk/webhook")).toBe(true); // Clerk runs, but nothing blocks it
    const { result, protect } = await runSignedOut("/api/clerk/webhook");
    expect(result).toBeUndefined();
    expect(protect).not.toHaveBeenCalled();
  });
  it("still answers 401 for an owner API route", async () => {
    const { result } = await runSignedOut("/api/projects");
    expect((result as Response).status).toBe(401);
  });
});
