import { describe, expect, it } from "vitest";
import { readPosthogConfig } from "./config";

describe("readPosthogConfig", () => {
  it("returns the key and host, trimmed, without a trailing slash", () => {
    expect(
      readPosthogConfig({ NEXT_PUBLIC_POSTHOG_KEY: " phc_abc ", NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com/" }),
    ).toEqual({ key: "phc_abc", host: "https://us.i.posthog.com" });
  });
  it("returns null when a variable is missing, blank or the host is not http(s)", () => {
    expect(readPosthogConfig({})).toBeNull();
    expect(readPosthogConfig({ NEXT_PUBLIC_POSTHOG_KEY: "phc_abc" })).toBeNull();
    expect(readPosthogConfig({ NEXT_PUBLIC_POSTHOG_KEY: " ", NEXT_PUBLIC_POSTHOG_HOST: "https://x.com" })).toBeNull();
    expect(readPosthogConfig({ NEXT_PUBLIC_POSTHOG_KEY: "phc_abc", NEXT_PUBLIC_POSTHOG_HOST: "not a url" })).toBeNull();
    expect(readPosthogConfig({ NEXT_PUBLIC_POSTHOG_KEY: "phc_abc", NEXT_PUBLIC_POSTHOG_HOST: "javascript:alert(1)" })).toBeNull();
  });
});
