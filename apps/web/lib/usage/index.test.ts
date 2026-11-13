import { describe, expect, it } from "vitest";
import { PLAN_LIMITS } from "@askwell/shared";
import {
  messagesUsedThisMonth,
  nextUtcMonthStart,
  startOfUtcMonth,
  toUsageSummary,
  usagePercent,
} from "./index";

const at = (iso: string) => new Date(iso);

describe("startOfUtcMonth / nextUtcMonthStart", () => {
  it("returns the first instant of this and next UTC month", () => {
    const now = at("2026-11-13T15:30:00Z");
    expect(startOfUtcMonth(now).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(nextUtcMonthStart(now).toISOString()).toBe("2026-12-01T00:00:00.000Z");
  });
  it("rolls December over to January of the next year", () => {
    const now = at("2026-12-31T23:59:59.999Z");
    expect(startOfUtcMonth(now).toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(nextUtcMonthStart(now).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
  it("uses UTC, not local time (a local evening can already be next month in UTC)", () => {
    // 2026-11-30 20:00 in New York is 2026-12-01 01:00 UTC.
    const now = at("2026-11-30T20:00:00-05:00");
    expect(startOfUtcMonth(now).toISOString()).toBe("2026-12-01T00:00:00.000Z");
  });
  it("handles February in a leap year", () => {
    expect(nextUtcMonthStart(at("2028-02-29T12:00:00Z")).toISOString()).toBe("2028-03-01T00:00:00.000Z");
  });
  it("is exact at the month boundary", () => {
    const now = at("2026-11-01T00:00:00.000Z");
    expect(startOfUtcMonth(now).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(nextUtcMonthStart(now).toISOString()).toBe("2026-12-01T00:00:00.000Z");
  });
});

describe("messagesUsedThisMonth", () => {
  const now = at("2026-11-13T10:00:00Z");
  it("keeps the count when the period is the current month", () => {
    expect(messagesUsedThisMonth(42, "2026-11-01T00:00:00+00:00", now)).toBe(42);
  });
  it("shows 0 for a stale period (before this UTC month)", () => {
    expect(messagesUsedThisMonth(42, "2026-10-01T00:00:00+00:00", now)).toBe(0);
    expect(messagesUsedThisMonth(100, "2025-11-01T00:00:00+00:00", now)).toBe(0);
  });
  it("treats one microsecond before the month as stale", () => {
    expect(messagesUsedThisMonth(5, "2026-10-31T23:59:59.999+00:00", now)).toBe(0);
  });
  it("reads Postgres timestamps with other offsets correctly", () => {
    // 2026-11-01 00:00 UTC written with a +02:00 offset is still this month.
    expect(messagesUsedThisMonth(7, "2026-11-01T02:00:00+02:00", now)).toBe(7);
  });
  it("shows 0 for an unreadable date or a negative count", () => {
    expect(messagesUsedThisMonth(3, "not a date", now)).toBe(0);
    expect(messagesUsedThisMonth(-1, "2026-11-01T00:00:00+00:00", now)).toBe(0);
  });
});

describe("usagePercent", () => {
  it("is a whole percent, rounded down", () => {
    expect(usagePercent(0, 100)).toBe(0);
    expect(usagePercent(1, 100)).toBe(1);
    expect(usagePercent(1, 2000)).toBe(0);
    expect(usagePercent(1999, 2000)).toBe(99);
    expect(usagePercent(2000, 2000)).toBe(100);
  });
  it("never goes past 100 or below 0", () => {
    expect(usagePercent(150, 100)).toBe(100);
    expect(usagePercent(-5, 100)).toBe(0);
  });
  it("is 100 for a zero limit", () => {
    expect(usagePercent(0, 0)).toBe(100);
  });
});

describe("toUsageSummary", () => {
  const now = at("2026-11-13T10:00:00Z");
  const current = "2026-11-01T00:00:00+00:00";

  it("uses the Free limit from PLAN_LIMITS", () => {
    expect(toUsageSummary({ messages_used: 25, period_start: current }, "free", now)).toEqual({
      used: 25,
      limit: PLAN_LIMITS.free.messagesPerMonth,
      percent: 25,
      quotaReached: false,
      resetsAt: "2026-12-01T00:00:00.000Z",
      plan: "free",
    });
  });
  it("uses the Pro limit from PLAN_LIMITS", () => {
    const s = toUsageSummary({ messages_used: 500, period_start: current }, "pro", now);
    expect(s.limit).toBe(PLAN_LIMITS.pro.messagesPerMonth);
    expect(s.percent).toBe(25);
    expect(s.quotaReached).toBe(false);
  });
  it("marks the quota reached at the limit", () => {
    const s = toUsageSummary({ messages_used: PLAN_LIMITS.free.messagesPerMonth, period_start: current }, "free", now);
    expect(s).toMatchObject({ quotaReached: true, percent: 100 });
  });
  it("shows a stale period as 0 and not reached, even if it was full", () => {
    const s = toUsageSummary({ messages_used: 100, period_start: "2026-10-01T00:00:00+00:00" }, "free", now);
    expect(s).toMatchObject({ used: 0, percent: 0, quotaReached: false });
  });
  it("is not reached on Pro at the Free limit (after an upgrade)", () => {
    expect(toUsageSummary({ messages_used: 100, period_start: current }, "pro", now).quotaReached).toBe(false);
  });
});
