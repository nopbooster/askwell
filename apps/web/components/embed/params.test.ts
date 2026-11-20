import { describe, expect, it } from "vitest";
import { parseParentOrigin, readEmbedParams } from "./params";

describe("parseParentOrigin", () => {
  it.each(["https://example.com", "http://localhost:3000", "https://shop.example.co.uk:8443"])("accepts the plain origin %s", (o) => {
    expect(parseParentOrigin(o)).toBe(o);
  });
  it.each(["https://*.example.com", "https://*", "http://*:3000", "https://a*b.example.com", "https://example.*"])(
    "rejects a * in the host: %s (it must never look like a wildcard target)",
    (o) => {
      expect(parseParentOrigin(o)).toBeNull();
    },
  );
  it.each(["*", "null", "https://example.com/", "https://example.com/path", "javascript:alert(1)", "file:///etc", "", undefined, null])(
    "still rejects %j",
    (o) => {
      expect(parseParentOrigin(o)).toBeNull();
    },
  );
});

describe("readEmbedParams", () => {
  it("drops a * host origin but keeps a valid key", () => {
    expect(readEmbedParams({ key: "pk_abcdefghijklmnop1234", origin: "https://*.example.com" })).toEqual({
      key: "pk_abcdefghijklmnop1234",
      origin: null,
    });
  });
});
