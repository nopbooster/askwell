import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { UsageSummary } from "../../lib/usage";
import { UsageCard, formatResetDate } from "./usage-card";

const base: UsageSummary = {
  used: 25,
  limit: 100,
  percent: 25,
  quotaReached: false,
  resetsAt: "2026-12-01T00:00:00.000Z",
  plan: "free",
};
const render = (u: Partial<UsageSummary>) => renderToStaticMarkup(<UsageCard usage={{ ...base, ...u }} />);

describe("formatResetDate", () => {
  it("shows the UTC date, so midnight UTC never reads as the day before", () => {
    expect(formatResetDate("2026-12-01T00:00:00.000Z")).toBe("December 1, 2026");
  });
});

describe("UsageCard", () => {
  it("shows used / limit, the percent, the plan and the reset date", () => {
    const html = render({});
    expect(html).toContain("25");
    expect(html).toContain("/ 100");
    expect(html).toContain("25% used");
    expect(html).toContain("Free plan");
    expect(html).toContain("Resets on December 1, 2026");
    expect(html).not.toContain("Monthly limit reached");
  });
  it("renders an accessible progress bar sized to the percent", () => {
    const html = render({});
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="25"');
    expect(html).toContain('aria-valuemax="100"');
    expect(html).toContain("width:25%");
  });
  it("formats Pro numbers with separators", () => {
    const html = render({ used: 1500, limit: 2000, percent: 75, plan: "pro" });
    expect(html).toContain("1,500");
    expect(html).toContain("/ 2,000");
    expect(html).toContain("Pro plan");
  });
  it("shows the empty note when nothing is used yet", () => {
    expect(render({ used: 0, percent: 0 })).toContain("No messages yet this month");
    expect(render({})).not.toContain("No messages yet this month");
  });
  it("shows the quota-reached state with an upgrade link on Free", () => {
    const html = render({ used: 100, percent: 100, quotaReached: true });
    expect(html).toContain("Monthly limit reached");
    expect(html).toContain("Answers start again on December 1, 2026");
    expect(html).toContain('href="/dashboard/billing"');
    expect(html).toContain("2,000 messages a month");
  });
  it("shows the quota-reached state without an upgrade link on Pro", () => {
    const html = render({ used: 2000, limit: 2000, percent: 100, quotaReached: true, plan: "pro" });
    expect(html).toContain("Monthly limit reached");
    expect(html).not.toContain("/dashboard/billing");
  });
});
