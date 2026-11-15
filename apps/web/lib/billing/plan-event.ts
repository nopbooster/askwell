import type { Plan } from "@askwell/shared";

/** The Clerk Billing plan slug that unlocks Pro (project.md §5, §6.10). */
export const PRO_PLAN_SLUG = "pro";

/**
 * What a verified webhook event asks for. `sync`: re-read the user's current Clerk subscription and
 * set `accounts.plan` from it. The event itself is only a trigger, never the truth: Svix retries and
 * delivers out of order, so a late `ended` (or `active`) for an old item must not decide the plan
 * (docs/phase6-security-review.md §3).
 */
export type PlanDecision = { action: "sync"; userId: string; reason: string } | { action: "ignore"; reason: string };

/** A Clerk webhook event as this filter sees it. `data` is untrusted: every field is checked. */
export type BillingEventLike = { type: string; data?: unknown };

function field(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;
}

/**
 * The fast filter: which verified events can change a user's plan. Pure, no I/O.
 * Every `subscriptionItem.*` event paid by a user triggers a sync, whatever its plan: Pro items
 * obviously, and Free items too (Clerk's Free plan slug is instance config, e.g. `free_user`, and its
 * events come with Pro changes). Organization payers, malformed payloads and other event types are ignored.
 */
export function planDecisionForEvent(event: BillingEventLike): PlanDecision {
  if (!event.type.startsWith("subscriptionItem.")) return { action: "ignore", reason: "not a subscription item event" };
  const userId = field(field(event.data, "payer"), "user_id");
  if (typeof userId !== "string" || userId === "") return { action: "ignore", reason: "no user payer" };
  const slug = field(field(event.data, "plan"), "slug");
  return { action: "sync", userId, reason: `${event.type} (${typeof slug === "string" ? slug : "unknown plan"})` };
}

/** A subscription item as Clerk's Backend API returns it (only the fields the rule reads). */
export type SubscriptionItemLike = {
  status: string;
  plan: { slug: string } | null;
  periodEnd: number | null;
};

/** Clerk sends Unix time in milliseconds; accept seconds too, so a unit change can't keep Pro forever. */
function toMs(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return value < 1e12 ? value * 1000 : value;
}

/**
 * The plan from the user's CURRENT Clerk subscription (the truth). Pro when any `pro` item is
 * `active` or `past_due` (Clerk's grace period; a cancellation in the paid period also stays `active`
 * until it ends), or `canceled` with its paid period still running. Free otherwise, including no
 * subscription at all. Pure: `now` is passed in.
 */
export function planFromSubscription(items: readonly SubscriptionItemLike[] | null, now: number = Date.now()): Plan {
  for (const item of items ?? []) {
    if (item.plan?.slug !== PRO_PLAN_SLUG) continue;
    if (item.status === "active" || item.status === "past_due") return "pro";
    if (item.status === "canceled") {
      const end = toMs(item.periodEnd);
      if (end !== null && end > now) return "pro";
    }
  }
  return "free";
}
