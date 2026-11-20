import { describe, expect, it } from "vitest";
import { describeError, ExtractionError, MAX_LOGGED_ERROR_CHARS, NoTextError } from "./errors";

describe("describeError", () => {
  it("keeps only the name and message", () => {
    const error = new ExtractionError("bad pdf", { cause: new Error("inner with text") });
    expect(describeError(error)).toEqual({ name: "ExtractionError", message: "bad pdf" });
    expect(describeError(new NoTextError())).toEqual({ name: "NoTextError", message: "The file contains no extractable text." });
  });

  it("redacts anything that looks like an API key", () => {
    expect(describeError(new Error("Incorrect API key provided: sk-proj-AbC_12-x****wxyz. See docs")).message).toBe(
      "Incorrect API key provided: sk-[redacted]. See docs",
    );
  });

  it("caps a long message", () => {
    const { message } = describeError(new Error("x".repeat(MAX_LOGGED_ERROR_CHARS + 50)));
    expect(message).toHaveLength(MAX_LOGGED_ERROR_CHARS + 1);
    expect(message.endsWith("…")).toBe(true);
  });

  it("handles non-Error values", () => {
    expect(describeError("plain")).toEqual({ name: "string", message: "plain" });
    expect(describeError({ secret: "x" })).toEqual({ name: "object", message: "" });
    expect(describeError(undefined)).toEqual({ name: "undefined", message: "" });
  });
});
