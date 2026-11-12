import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const createClient = vi.fn<(...args: unknown[]) => unknown>(() => ({ marker: "service" }));
vi.mock("@supabase/supabase-js", () => ({ createClient: (...a: unknown[]) => createClient(...a) }));

import { createServiceClient } from "./service";

// Built from parts so this file itself never contains the literal name.
const SECRET_VAR = ["SUPABASE", "SECRET", "KEY"].join("_");
const here = dirname(fileURLToPath(import.meta.url));
const appsDir = resolve(here, "../../..");

beforeEach(() => {
  createClient.mockClear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv(SECRET_VAR, "sb_secret_test");
});

describe("createServiceClient", () => {
  it("uses the secret key and never persists a session", () => {
    createServiceClient();
    const [url, key, options] = createClient.mock.calls[0] as [
      string,
      string,
      { auth: Record<string, boolean> },
    ];
    expect(url).toBe("https://example.supabase.co");
    expect(key).toBe("sb_secret_test");
    expect(options.auth).toMatchObject({ persistSession: false, autoRefreshToken: false });
  });

  it("names the secret variable when it is missing", () => {
    vi.stubEnv(SECRET_VAR, undefined);
    expect(() => createServiceClient()).toThrow(new RegExp(`${SECRET_VAR} is missing`));
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (["node_modules", ".next", "dist", "coverage"].includes(name)) return [];
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe("secret key containment", () => {
  const files = walk(appsDir).map((f) => relative(appsDir, f));
  const mentions = files.filter(
    (f) => /\.(m?[jt]sx?|json|env.*)$/.test(f) && readFileSync(join(appsDir, f), "utf8").includes(SECRET_VAR),
  );

  it("appears in no file under apps/ except service.ts and its test", () => {
    expect(mentions.sort()).toEqual(["web/lib/supabase/service.ts"]);
  });

  it("service.ts imports server-only", () => {
    const src = readFileSync(join(here, "service.ts"), "utf8");
    expect(src).toMatch(/^import "server-only";/m);
  });
});
