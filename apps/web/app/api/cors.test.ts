/**
 * CORS audit (project.md §9 CORS): the public widget routes allow any origin; every other API route
 * (owner routes, the Clerk webhook, PostHog config) sends no Access-Control-Allow-* header and never
 * allows a cross-origin preflight. Read-only: these tests lock the current behavior in.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Signed out, no database, Arcjet allows: every handler can run its early paths.
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: null, isAuthenticated: false, has: () => false }),
  clerkMiddleware: (handler: unknown) => handler,
  currentUser: async () => null,
}));
const noDb = () => {
  throw new Error("no database in the CORS audit");
};
vi.mock("../../lib/supabase/owner", () => ({ createOwnerClient: noDb }));
vi.mock("../../lib/supabase/service", () => ({ createServiceClient: noDb }));
vi.mock("../../lib/arcjet", () => ({
  protectWidgetRequest: async () => ({ status: "allowed" }),
  detectPromptInjection: async () => ({ status: "allowed" }),
}));

const API_DIR = __dirname;
const FOREIGN_ORIGIN = "https://evil.example";

/** Every route.ts under app/api, as a path relative to app/api ("widget/chat/route.ts"). */
function routeFiles(dir = API_DIR): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return routeFiles(full);
    return name === "route.ts" ? [relative(API_DIR, full)] : [];
  });
}

const PUBLIC_ROUTES = ["widget/chat/route.ts", "widget/config/route.ts"];
/** Every non-public route, classified on purpose: a new route must be added here (and reviewed). */
const PRIVATE_ROUTES = [
  "clerk/webhook/route.ts",
  "conversations/[id]/route.ts",
  "knowledge/[id]/route.ts",
  "posthog-config/route.ts",
  "projects/[id]/config/route.ts",
  "projects/[id]/conversations/route.ts",
  "projects/[id]/knowledge/finalize/route.ts",
  "projects/[id]/knowledge/route.ts",
  "projects/[id]/knowledge/upload-url/route.ts",
  "projects/[id]/route.ts",
  "projects/route.ts",
];
const METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"] as const;

const corsHeaders = (res: Response) =>
  [...res.headers.keys()].filter((k) => k.toLowerCase().startsWith("access-control-"));

describe("route inventory", () => {
  it("every API route is classified as public (widget) or private", () => {
    expect(routeFiles().sort()).toEqual([...PUBLIC_ROUTES, ...PRIVATE_ROUTES].sort());
  });
});

describe("public widget routes allow any origin (incl. preflight)", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));

  it("GET /api/widget/config: OPTIONS and a real (400) response allow *", async () => {
    const { OPTIONS, GET } = await import("./widget/config/route");
    const pre = OPTIONS();
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-origin")).toBe("*");
    expect(pre.headers.get("access-control-allow-methods")).toContain("GET");
    expect(pre.headers.get("access-control-allow-credentials")).toBeNull(); // never with credentials
    const res = await GET(new Request("https://app.test/api/widget/config?key=nope", { headers: { Origin: FOREIGN_ORIGIN } }));
    expect(res.status).toBe(400);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("POST /api/widget/chat: OPTIONS and a real (400) response allow *", async () => {
    const { OPTIONS, POST } = await import("./widget/chat/route");
    const pre = OPTIONS();
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-origin")).toBe("*");
    expect(pre.headers.get("access-control-allow-methods")).toContain("POST");
    expect(pre.headers.get("access-control-allow-headers")).toContain("Content-Type");
    expect(pre.headers.get("access-control-allow-credentials")).toBeNull();
    const res = await POST(
      new Request("https://app.test/api/widget/chat", {
        method: "POST",
        headers: { Origin: FOREIGN_ORIGIN, "Content-Type": "application/json" },
        body: "{}",
      }),
    );
    expect(res.status).toBe(400);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});

describe("private routes send no Access-Control-Allow-* and allow no preflight", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it.each(PRIVATE_ROUTES)("%s: no OPTIONS handler and no Access-Control header in the source", (file) => {
    const source = readFileSync(join(API_DIR, file), "utf8");
    expect(source).not.toMatch(/export\s+(async\s+)?(function|const)\s+OPTIONS\b/);
    expect(source).not.toMatch(/Access-Control-/i);
  });

  it.each(PRIVATE_ROUTES)("%s: every handler answers a cross-origin request without CORS headers", async (file) => {
    const mod = (await import(`./${file.replace(/\.ts$/, "")}`)) as Record<string, unknown>;
    const handlers = METHODS.filter((m) => typeof mod[m] === "function");
    expect(handlers.length).toBeGreaterThan(0);
    expect(handlers).not.toContain("OPTIONS");
    for (const method of handlers) {
      const request = new Request(`https://app.test/api/${file.replace(/\/route\.ts$/, "")}`, {
        method,
        headers: { Origin: FOREIGN_ORIGIN, "Content-Type": "application/json" },
        body: method === "GET" ? undefined : "{}",
      });
      // Each handler must answer (signed out / bad id / no config → 4xx or 5xx), not throw, so the
      // check runs on a real response. Today all 14 do: 400, 401, 500 or 503.
      const res = await (mod[method] as (r: Request, c: unknown) => Promise<Response>)(request, {
        params: Promise.resolve({ id: "not-a-uuid" }),
      });
      expect(res, `${method} ${file}`).toBeInstanceOf(Response);
      expect(corsHeaders(res), `${method} ${file}`).toEqual([]);
    }
  });
});

describe("cross-origin preflight through the auth proxy", () => {
  type Handler = (auth: unknown, req: { nextUrl: URL; method: string; headers: Headers }) => Promise<unknown>;
  const preflight = async (path: string) => {
    const { default: proxy } = await import("../../proxy");
    const auth = Object.assign(async () => ({ isAuthenticated: false }), {
      protect: async () => {
        throw new Error("redirect to sign-in");
      },
    });
    return (proxy as unknown as Handler)(auth, {
      nextUrl: new URL(`https://app.test${path}`),
      method: "OPTIONS",
      headers: new Headers({ Origin: FOREIGN_ORIGIN, "Access-Control-Request-Method": "POST" }),
    });
  };

  it.each(["/api/projects", "/api/projects/abc/knowledge", "/api/projects/abc/knowledge/upload-url", "/api/projects/abc/knowledge/finalize", "/api/projects/abc/conversations", "/api/projects/abc/config", "/api/conversations/abc", "/api/knowledge/abc"])(
    "OPTIONS %s from another origin: 401, no Access-Control-Allow-* (not a successful preflight)",
    async (path) => {
      const res = (await preflight(path)) as Response;
      expect(res).toBeInstanceOf(Response);
      expect(res.status).toBe(401);
      expect(corsHeaders(res)).toEqual([]);
    },
  );

  it.each(["/api/clerk/webhook", "/api/posthog-config"])(
    "OPTIONS %s passes the proxy untouched (the route has no OPTIONS, so Next answers without CORS headers)",
    async (path) => {
      expect(await preflight(path)).toBeUndefined();
    },
  );
});
