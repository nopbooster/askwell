import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLAN_LIMITS } from "@askwell/shared";

const { openUserProfile, clerk } = vi.hoisted(() => {
  const openUserProfile = vi.fn();
  return { openUserProfile, clerk: { loaded: true, openUserProfile } };
});
const pricingTable = vi.fn();
vi.mock("@clerk/nextjs", () => ({
  useClerk: () => clerk,
  PricingTable: (props: Record<string, unknown>) => {
    pricingTable(props);
    if (props.__throw) throw new Error("cannot_render_billing_disabled");
    return <div data-testid="pricing-table" />;
  },
}));

import { BILLING_PROFILE_PATH, CurrentPlanCard, ManageSubscriptionButton, PricingSection } from "./index";

beforeEach(() => {
  openUserProfile.mockReset();
  pricingTable.mockReset();
  clerk.loaded = true;
});

describe("CurrentPlanCard", () => {
  it("shows Free with its limits from PLAN_LIMITS", () => {
    const html = renderToStaticMarkup(<CurrentPlanCard plan="free" />);
    expect(html).toContain("Current plan");
    expect(html).toContain(">Free<");
    expect(html).toContain("$0");
    expect(html).toContain(`${PLAN_LIMITS.free.messagesPerMonth} messages per month`);
    expect(html).toContain("Default widget look");
  });
  it("shows Pro with its limits", () => {
    const html = renderToStaticMarkup(<CurrentPlanCard plan="pro" />);
    expect(html).toContain(">Pro<");
    expect(html).toContain(`${PLAN_LIMITS.pro.projects} projects`);
    expect(html).toContain("2,000 messages per month");
    expect(html).toContain("No “Powered by” badge");
  });
});

describe("ManageSubscriptionButton", () => {
  it("opens Clerk's account portal on the Billing tab", () => {
    const element = ManageSubscriptionButton() as unknown as { props: { onClick: () => void; disabled: boolean } };
    expect(element.props.disabled).toBe(false);
    element.props.onClick();
    expect(openUserProfile).toHaveBeenCalledWith({ __experimental_startPath: BILLING_PROFILE_PATH });
    expect(BILLING_PROFILE_PATH).toBe("/billing");
  });
  it("is disabled until Clerk has loaded", () => {
    clerk.loaded = false;
    const html = renderToStaticMarkup(<ManageSubscriptionButton />);
    expect(html).toContain("disabled");
    expect(html).toContain("Manage subscription");
  });
});

describe("PricingSection", () => {
  it("renders Clerk's pricing table for the user, back to Billing after checkout, with a loading fallback", () => {
    const html = renderToStaticMarkup(<PricingSection />);
    expect(html).toContain('data-testid="pricing-table"');
    const props = pricingTable.mock.calls[0]?.[0];
    expect(props).toMatchObject({ for: "user", newSubscriptionRedirectUrl: "/dashboard/billing" });
    expect(props?.fallback).toBeTruthy();
  });
});
