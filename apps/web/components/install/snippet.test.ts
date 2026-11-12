import { describe, expect, it } from "vitest";
import { buildInstallSnippet } from "./snippet";

const KEY = "pk_abcdefghijklmnop1234";

describe("buildInstallSnippet", () => {
  it("builds the script tag", () => {
    expect(buildInstallSnippet("https://askwell.app", KEY)).toBe(
      `<script src="https://askwell.app/widget.js" data-key="${KEY}" async></script>`,
    );
  });
  it("trims trailing slashes from the base URL", () => {
    expect(buildInstallSnippet("https://askwell.app//", KEY)).toContain('src="https://askwell.app/widget.js"');
  });
  it("rejects keys that don't match PUBLIC_KEY_REGEX", () => {
    for (const bad of ["", "pk_short", "sk_abcdefghijklmnop1234", `${KEY}"><script>`, `${KEY} `]) {
      expect(() => buildInstallSnippet("https://askwell.app", bad)).toThrow();
    }
  });
});
