import { describe, expect, it } from "vitest";
import {
  isThemedPath,
  parsePreference,
  resolveTheme,
  themeForPath,
  THEME_INIT_SCRIPT,
} from "./theme";

describe("theme logic", () => {
  it("parses stored values, defaulting to system", () => {
    expect(parsePreference("light")).toBe("light");
    expect(parsePreference("dark")).toBe("dark");
    expect(parsePreference("system")).toBe("system");
    expect(parsePreference(null)).toBe("system");
    expect(parsePreference("purple")).toBe("system");
  });
  it("resolves the effective theme", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
  it("themes only dashboard, sign-in and sign-up", () => {
    for (const p of [
      "/dashboard",
      "/dashboard/p/1/install",
      "/sign-in",
      "/sign-in/factor-one",
      "/sign-up",
    ]) {
      expect(isThemedPath(p)).toBe(true);
    }
    for (const p of ["/", "/embed", "/embed/x", "/dashboardx", "/api/widget/config"]) {
      expect(isThemedPath(p)).toBe(false);
    }
  });
  it("ignores /embed and the landing page", () => {
    expect(themeForPath("/embed", "dark", true)).toBeNull();
    expect(themeForPath("/", "dark", true)).toBeNull();
    expect(themeForPath("/dashboard", null, true)).toBe("dark");
    expect(themeForPath("/dashboard", "light", true)).toBe("light");
  });
  it("init script embeds the same path rule and storage key", () => {
    expect(THEME_INIT_SCRIPT).toContain("dashboard|sign-in|sign-up");
    expect(THEME_INIT_SCRIPT).toContain("-theme");
  });
});
