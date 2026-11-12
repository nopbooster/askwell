import { describe, expect, it } from "vitest";
import { parsePublicSupabaseEnv, requireServerSecret } from "./env";

const good = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};

describe("parsePublicSupabaseEnv", () => {
  it("returns the url and publishable key", () => {
    expect(parsePublicSupabaseEnv(good)).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_test",
    });
  });

  it("names the missing url", () => {
    expect(() => parsePublicSupabaseEnv({ ...good, NEXT_PUBLIC_SUPABASE_URL: undefined })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL is missing/,
    );
  });

  it("names the missing publishable key", () => {
    expect(() =>
      parsePublicSupabaseEnv({ ...good, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing/);
  });

  it("names every bad variable at once, and rejects a non-URL", () => {
    expect(() => parsePublicSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "nope" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL must be a URL.*NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing/,
    );
  });
});

describe("requireServerSecret", () => {
  it("returns a set value", () => {
    expect(requireServerSecret("X_SECRET", "abc")).toBe("abc");
  });
  it.each([undefined, ""])("names the variable when it is %j", (value) => {
    expect(() => requireServerSecret("X_SECRET", value)).toThrow(/X_SECRET is missing/);
  });
});
