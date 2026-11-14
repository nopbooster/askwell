import { describe, expect, it } from "vitest";
import { PRO_PLAN_SLUG, planDecisionForEvent } from "./plan-event";

const NOW = Date.UTC(2026, 10, 14, 12, 0, 0);
const DAY = 86_400_000;
const item = (type: string, over: Record<string, unknown> = {}) => ({
  type,
  data: {
    object: "commerce_subscription_item",
    id: "csi_1",
    status: "active",
    plan: { id: "cplan_pro", slug: PRO_PLAN_SLUG, name: "Pro" },
    payer: { user_id: "user_abc", email: "owner@example.com" },
    period_start: NOW - 10 * DAY,
    period_end: NOW + 20 * DAY,
    ...over,
  },
});

describe("planDecisionForEvent", () => {
  it("Pro item active → pro", () => {
    expect(planDecisionForEvent(item("subscriptionItem.active"), NOW)).toEqual({
      action: "set",
      userId: "user_abc",
      plan: "pro",
      reason: "Pro item active",
    });
  });
  it("Pro item ended or expired → free", () => {
    for (const type of ["subscriptionItem.ended", "subscriptionItem.expired"]) {
      expect(planDecisionForEvent(item(type, { status: "ended" }), NOW)).toMatchObject({
        action: "set",
        userId: "user_abc",
        plan: "free",
      });
    }
  });
  it("canceled while the paid period runs → no change (Pro stays until it ends)", () => {
    expect(planDecisionForEvent(item("subscriptionItem.canceled", { status: "canceled" }), NOW)).toEqual({
      action: "ignore",
      reason: "canceled: Pro stays until the paid period ends",
    });
  });
  it("canceled after the period already ended → free", () => {
    const d = planDecisionForEvent(item("subscriptionItem.canceled", { period_end: NOW - DAY }), NOW);
    expect(d).toMatchObject({ action: "set", plan: "free" });
    expect(planDecisionForEvent(item("subscriptionItem.canceled", { period_end: NOW }), NOW)).toMatchObject({ plan: "free" });
  });
  it("reads a period end sent in seconds too", () => {
    const inSeconds = Math.floor((NOW + DAY) / 1000);
    expect(planDecisionForEvent(item("subscriptionItem.canceled", { period_end: inSeconds }), NOW).action).toBe("ignore");
    const pastSeconds = Math.floor((NOW - DAY) / 1000);
    expect(planDecisionForEvent(item("subscriptionItem.canceled", { period_end: pastSeconds }), NOW)).toMatchObject({ plan: "free" });
  });
  it("canceled with no period end → no change", () => {
    expect(planDecisionForEvent(item("subscriptionItem.canceled", { period_end: null }), NOW).action).toBe("ignore");
  });
  it("upcoming (renewal notice) → no change", () => {
    expect(planDecisionForEvent(item("subscriptionItem.upcoming", { status: "upcoming" }), NOW)).toEqual({
      action: "ignore",
      reason: "no plan change for subscriptionItem.upcoming",
    });
  });
  it("past due, updated, incomplete, abandoned, free trial ending → no change", () => {
    for (const type of [
      "subscriptionItem.pastDue",
      "subscriptionItem.updated",
      "subscriptionItem.incomplete",
      "subscriptionItem.abandoned",
      "subscriptionItem.freeTrialEnding",
    ]) {
      expect(planDecisionForEvent(item(type), NOW).action).toBe("ignore");
    }
  });
  it("another plan's events are ignored, even ended (an upgrade ends the Free item)", () => {
    for (const type of ["subscriptionItem.active", "subscriptionItem.ended"]) {
      expect(planDecisionForEvent(item(type, { plan: { slug: "free_user" } }), NOW)).toEqual({
        action: "ignore",
        reason: "not the Pro plan",
      });
    }
  });
  it("unknown and non-item events are ignored", () => {
    expect(planDecisionForEvent(item("subscriptionItem.somethingNew"), NOW).action).toBe("ignore");
    expect(planDecisionForEvent({ type: "user.created", data: { id: "user_abc" } }, NOW)).toEqual({
      action: "ignore",
      reason: "not a subscription item event",
    });
    expect(planDecisionForEvent({ type: "subscription.active", data: { items: [] } }, NOW).action).toBe("ignore");
  });
  it("an organization payer (no user_id) or a malformed payload is ignored", () => {
    expect(planDecisionForEvent(item("subscriptionItem.active", { payer: { organization_id: "org_1" } }), NOW)).toEqual({
      action: "ignore",
      reason: "no user payer",
    });
    for (const data of [undefined, null, "x", { plan: null }, { plan: { slug: "pro" }, payer: { user_id: 42 } }]) {
      expect(planDecisionForEvent({ type: "subscriptionItem.active", data }, NOW).action).toBe("ignore");
    }
  });
});
