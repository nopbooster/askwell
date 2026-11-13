import { describe, expect, it } from "vitest";
import { formatTimestamp, messageCountLabel, previewLabel } from "./format";

describe("formatTimestamp", () => {
  it("shows date and 24-hour time in UTC", () => {
    expect(formatTimestamp("2026-11-12T10:01:30+00:00")).toBe("Nov 12, 2026, 10:01 UTC");
  });
  it("converts other offsets to UTC (late evening can be the next day)", () => {
    expect(formatTimestamp("2026-11-12T23:30:00-05:00")).toBe("Nov 13, 2026, 04:30 UTC");
  });
  it("shows midnight as 00:00", () => {
    expect(formatTimestamp("2026-11-12T00:00:00Z")).toBe("Nov 12, 2026, 00:00 UTC");
  });
  it("returns an empty string for an unreadable date", () => {
    expect(formatTimestamp("nope")).toBe("");
  });
});

describe("messageCountLabel", () => {
  it("uses the singular for one and separators for big numbers", () => {
    expect(messageCountLabel(0)).toBe("0 messages");
    expect(messageCountLabel(1)).toBe("1 message");
    expect(messageCountLabel(1234)).toBe("1,234 messages");
  });
});

describe("previewLabel", () => {
  it("keeps the preview, or shows a placeholder when it is empty", () => {
    expect(previewLabel("Hi")).toBe("Hi");
    expect(previewLabel("  ")).toBe("No visitor message yet");
  });
});
