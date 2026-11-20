import { describe, expect, it } from "vitest";
import { PRO_PLAN_SLUG, planDecisionForEvent, planFromSubscription, type SubscriptionItemLike } from "./plan-event";

const NOW = Date.UTC(2026, 10, 16, 12, 0, 0);
const DAY = 86_400_000;
const event = (type: string, data: Record<string, unknown> = {}) => ({
  type,
  data: { object: "commerce_subscription_item", plan: { slug: PRO_PLAN_SLUG }, payer: { user_id: "user_abc" }, ...data },
});

describe("planDecisionForEvent (the filter: which events trigger a sync)", () => {
  it.each(["active", "canceled", "ended", "expired", "upcoming", "updated", "pastDue", "incomplete", "abandoned", "freeTrialEnding", "somethingNew"])(
    "subscriptionItem.%s paid by a user → sync for that user (the event never decides the plan)",
    (kind) => {
      expect(planDecisionForEvent(event(`subscriptionItem.${kind}`))).toEqual({
        action: "sync",
        userId: "user_abc",
        reason: `subscriptionItem.${kind} (pro)`,
      });
    },
  );
  it("Free plan items trigger a sync too (their events come with Pro changes)", () => {
    expect(planDecisionForEvent(event("subscriptionItem.ended", { plan: { slug: "free_user" } }))).toMatchObject({
      action: "sync",
      userId: "user_abc",
    });
  });
  it("non-item events are ignored", () => {
    expect(planDecisionForEvent({ type: "user.created", data: { id: "user_abc" } })).toEqual({
      action: "ignore",
      reason: "not a subscription item event",
    });
    expect(planDecisionForEvent({ type: "subscription.active", data: { payer: { user_id: "user_abc" } } }).action).toBe("ignore");
  });
  it("an organization payer or a malformed payload is ignored", () => {
    expect(planDecisionForEvent(event("subscriptionItem.active", { payer: { organization_id: "org_1" } }))).toEqual({
      action: "ignore",
      reason: "no user payer",
    });
    for (const data of [undefined, null, "x", { payer: null }, { payer: { user_id: 42 } }, { payer: { user_id: "" } }]) {
      expect(planDecisionForEvent({ type: "subscriptionItem.active", data }).action).toBe("ignore");
    }
  });
});

describe("planFromSubscription (Clerk's current subscription → plan)", () => {
  const item = (status: string, over: Partial<SubscriptionItemLike> = {}): SubscriptionItemLike => ({
    status,
    plan: { slug: PRO_PLAN_SLUG },
    periodEnd: NOW + 20 * DAY,
    ...over,
  });
  const free = (status = "active"): SubscriptionItemLike => ({ status, plan: { slug: "free_user" }, periodEnd: null });

  it("active or past_due Pro item → pro", () => {
    expect(planFromSubscription([item("active")], NOW)).toBe("pro");
    expect(planFromSubscription([item("past_due")], NOW)).toBe("pro");
  });
  it("a cancellation in the paid period that Clerk still reports as active → pro", () => {
    expect(planFromSubscription([item("active"), free("upcoming")], NOW)).toBe("pro");
  });
  it("canceled Pro item → pro while its period runs, free once it has ended", () => {
    expect(planFromSubscription([item("canceled")], NOW)).toBe("pro");
    expect(planFromSubscription([item("canceled", { periodEnd: NOW - DAY })], NOW)).toBe("free");
    expect(planFromSubscription([item("canceled", { periodEnd: NOW })], NOW)).toBe("free");
    expect(planFromSubscription([item("canceled", { periodEnd: null })], NOW)).toBe("free");
  });
  it("reads a period end in seconds too", () => {
    expect(planFromSubscription([item("canceled", { periodEnd: Math.floor((NOW + DAY) / 1000) })], NOW)).toBe("pro");
    expect(planFromSubscription([item("canceled", { periodEnd: Math.floor((NOW - DAY) / 1000) })], NOW)).toBe("free");
  });
  it.each(["ended", "expired", "upcoming", "incomplete", "abandoned"])("a %s Pro item alone → free", (status) => {
    expect(planFromSubscription([item(status)], NOW)).toBe("free");
  });
  it("Free only, no items, or no subscription → free", () => {
    expect(planFromSubscription([free()], NOW)).toBe("free");
    expect(planFromSubscription([], NOW)).toBe("free");
    expect(planFromSubscription(null, NOW)).toBe("free");
  });
  it("an old ended Pro item next to a new active one → pro (any live Pro item wins)", () => {
    expect(planFromSubscription([item("ended", { periodEnd: NOW - 10 * DAY }), item("active")], NOW)).toBe("pro");
  });
  it("an item without a plan, or another plan's active item → free", () => {
    expect(planFromSubscription([item("active", { plan: null })], NOW)).toBe("free");
    expect(planFromSubscription([item("active", { plan: { slug: "enterprise" } })], NOW)).toBe("free");
  });
});
