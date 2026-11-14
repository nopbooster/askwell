import type { Plan } from "@askwell/shared";

/** The Clerk Billing plan slug that unlocks Pro (project.md §5, §6.10). Other plans' events are ignored. */
export const PRO_PLAN_SLUG = "pro";

export type PlanDecision =
  | { action: "set"; userId: string; plan: Plan; reason: string }
  | { action: "ignore"; reason: string };

/** A Clerk webhook event as this decision sees it. `data` is untrusted: every field is checked. */
export type BillingEventLike = { type: string; data?: unknown };

function field(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;
}

/** Clerk sends Unix time in milliseconds; accept seconds too, so a unit change can't keep Pro forever. */
function toMs(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value < 1e12 ? value * 1000 : value;
}

/**
 * What a verified Clerk Billing event means for `accounts.plan`. Pure: no I/O, `now` passed in.
 *
 * Only `subscriptionItem.*` events for the Pro plan, paid by a user, change anything:
 * - `active` → pro.
 * - `ended` / `expired` → free (the paid period is over).
 * - `canceled` → no change while the paid period runs (`ended` follows at its end). If the period
 *   is already over when the event arrives, free.
 * - everything else (`upcoming`, `updated`, `pastDue`, `incomplete`, `abandoned`, `freeTrialEnding`,
 *   unknown types) → no change. `pastDue` keeps Pro during Clerk's grace period; `ended` follows if it fails.
 *
 * Other plans are ignored on purpose: on an upgrade Clerk ends the Free item, which must not
 * downgrade the new Pro owner.
 */
export function planDecisionForEvent(event: BillingEventLike, now: number = Date.now()): PlanDecision {
  if (!event.type.startsWith("subscriptionItem.")) return { action: "ignore", reason: "not a subscription item event" };
  const data = event.data;
  if (field(field(data, "plan"), "slug") !== PRO_PLAN_SLUG) return { action: "ignore", reason: "not the Pro plan" };
  const userId = field(field(data, "payer"), "user_id");
  if (typeof userId !== "string" || userId === "") return { action: "ignore", reason: "no user payer" };

  switch (event.type) {
    case "subscriptionItem.active":
      return { action: "set", userId, plan: "pro", reason: "Pro item active" };
    case "subscriptionItem.ended":
    case "subscriptionItem.expired":
      return { action: "set", userId, plan: "free", reason: "Pro item ended" };
    case "subscriptionItem.canceled": {
      const periodEnd = toMs(field(data, "period_end"));
      if (periodEnd !== null && periodEnd <= now) {
        return { action: "set", userId, plan: "free", reason: "Pro item canceled after its period ended" };
      }
      return { action: "ignore", reason: "canceled: Pro stays until the paid period ends" };
    }
    default:
      return { action: "ignore", reason: `no plan change for ${event.type}` };
  }
}
