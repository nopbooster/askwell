import { describe, expect, it } from "vitest";
import { isDashboardRoute, isOwnerApiRoute, isProtectedRoute, isPublicRoute } from "./routes";

const OWNER_ROUTES = [
  "/api/projects",
  "/api/projects/abc",
  "/api/projects/abc/knowledge",
  "/api/projects/abc/knowledge/upload-url",
  "/api/projects/abc/knowledge/finalize",
  "/api/knowledge/abc",
  "/api/projects/abc/conversations",
  "/api/conversations/abc",
  "/api/projects/abc/config",
];

const PUBLIC_ROUTES = [
  "/",
  "/sign-in",
  "/sign-in/factor-one",
  "/sign-up",
  "/sign-up/verify-email-address",
  "/embed",
  "/embed/abc",
  "/api/widget/config",
  "/api/widget/chat",
  "/api/clerk/webhook",
  "/api/posthog-config",
];

describe("owner routes (§8)", () => {
  it.each(OWNER_ROUTES)("%s is protected", (path) => {
    expect(isOwnerApiRoute(path)).toBe(true);
    expect(isProtectedRoute(path)).toBe(true);
    expect(isPublicRoute(path)).toBe(false);
  });
});

describe("dashboard routes", () => {
  it.each(["/dashboard", "/dashboard/x", "/dashboard/projects/1"])("%s is protected", (path) => {
    expect(isDashboardRoute(path)).toBe(true);
    expect(isProtectedRoute(path)).toBe(true);
    expect(isPublicRoute(path)).toBe(false);
  });

  it("does not match look-alike paths", () => {
    expect(isProtectedRoute("/dashboards")).toBe(false);
    expect(isProtectedRoute("/api/projectsx")).toBe(false);
  });
});

describe("public routes", () => {
  it.each(PUBLIC_ROUTES)("%s is public", (path) => {
    expect(isPublicRoute(path)).toBe(true);
    expect(isProtectedRoute(path)).toBe(false);
  });
});

describe("Clerk webhook (§8 System)", () => {
  it("is public and never treated as an owner route, so deliveries without a session get through", () => {
    expect(isPublicRoute("/api/clerk/webhook")).toBe(true);
    expect(isOwnerApiRoute("/api/clerk/webhook")).toBe(false);
    expect(isDashboardRoute("/api/clerk/webhook")).toBe(false);
    expect(isProtectedRoute("/api/clerk/webhook")).toBe(false);
  });
});
