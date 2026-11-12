import { describe, expect, it } from "vitest";
import { formatCreatedDate, isAtProjectLimit, messagesLabel, projectLimitLabel } from "./limits";

describe("projectLimitLabel", () => {
  it("reads from PLAN_LIMITS", () => {
    expect(projectLimitLabel(1, "free")).toBe("1 of 1 project on Free");
    expect(projectLimitLabel(0, "free")).toBe("0 of 1 project on Free");
    expect(projectLimitLabel(3, "pro")).toBe("3 of 5 projects on Pro");
  });
});

describe("isAtProjectLimit", () => {
  it("is true at or over the plan's limit", () => {
    expect(isAtProjectLimit(0, "free")).toBe(false);
    expect(isAtProjectLimit(1, "free")).toBe(true);
    expect(isAtProjectLimit(4, "pro")).toBe(false);
    expect(isAtProjectLimit(5, "pro")).toBe(true);
  });
});

describe("messagesLabel", () => {
  it("shows used of limit", () => {
    expect(messagesLabel(3, 100)).toBe("3 of 100 messages this month");
    expect(messagesLabel(0, 1)).toBe("0 of 1 message this month");
  });
});

describe("formatCreatedDate", () => {
  it("formats in UTC", () => {
    expect(formatCreatedDate("2026-11-12T23:59:00+00:00")).toBe("Nov 12, 2026");
  });
  it("returns an empty string for a bad date", () => {
    expect(formatCreatedDate("nope")).toBe("");
  });
});
