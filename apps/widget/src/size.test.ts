import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs build helper, no types
import { MAX_GZIP_BYTES, buildWidget } from "../build.mjs";

describe("widget.js bundle", () => {
  it("is under the gzip budget and ships no zod", async () => {
    const { code, gzipBytes } = (await buildWidget()) as {
      code: string;
      gzipBytes: number;
    };
    expect(gzipBytes).toBeLessThan(MAX_GZIP_BYTES);
    expect(code).not.toMatch(/zod/i);
  });

  it("has no secrets in the bundle", async () => {
    const { code } = (await buildWidget()) as { code: string };
    expect(code).not.toMatch(/sk_|secret|SUPABASE|CLERK/i);
  });

  it("does not hardcode the app name in its source (it comes from APP_NAME)", () => {
    const dir = new URL(".", import.meta.url);
    const files = readdirSync(dir).filter(
      (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"),
    );
    expect(files.length).toBeGreaterThan(0);
    for (const f of files)
      expect(
        readFileSync(new URL(f, dir), "utf8").replaceAll("@askwell/", ""),
        f,
      ).not.toMatch(/askwell/i);
  });
});
