import { describe, expect, it } from "vitest";
import { DEFAULT_WIDGET_CONFIG } from "@askwell/shared";
import { isHexColor, textOn } from "./color";
import { sameConfig, validateConfig } from "./validate";

describe("color", () => {
  it("accepts only #rrggbb", () => {
    expect(isHexColor("#0a0a0a")).toBe(true);
    expect(isHexColor("#FFF")).toBe(false);
    expect(isHexColor("green")).toBe(false);
  });
  it("picks readable text: white on dark, black on light", () => {
    expect(textOn("#0a0a0a")).toBe("#ffffff");
    expect(textOn("#ffffff")).toBe("#0a0a0a");
    expect(textOn("#facc15")).toBe("#0a0a0a");
  });
});

describe("validateConfig", () => {
  it("passes the defaults", () => {
    expect(validateConfig(DEFAULT_WIDGET_CONFIG)).toEqual({});
  });
  it("flags a bad color and empty or too long text", () => {
    const errors = validateConfig({ ...DEFAULT_WIDGET_CONFIG, buttonColor: "red", label: " ", headerText: "x".repeat(61) });
    expect(Object.keys(errors).sort()).toEqual(["buttonColor", "headerText", "label"]);
  });
  it("sameConfig compares every field", () => {
    expect(sameConfig(DEFAULT_WIDGET_CONFIG, { ...DEFAULT_WIDGET_CONFIG })).toBe(true);
    expect(sameConfig(DEFAULT_WIDGET_CONFIG, { ...DEFAULT_WIDGET_CONFIG, showBadge: false })).toBe(false);
  });
});
