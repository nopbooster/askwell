import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextResponse, type NextRequest } from "next/server";
import { apiError, internalError } from "../../../../lib/api/http";
import { setAccountPlan } from "../../../../lib/billing/accounts";
import { planDecisionForEvent } from "../../../../lib/billing";

/**
 * POST /api/clerk/webhook: Clerk Billing → `accounts.plan` (project.md §6.10, §8 System).
 * Public (no Clerk session); the Svix signature is the only check and runs before anything else.
 * 2xx tells Clerk it's handled; a 5xx makes Clerk retry.
 *
 * Events we act on (decision in `planDecisionForEvent`, lib/billing/plan-event.ts). Only Clerk
 * Billing **subscription item** events for the plan whose slug is exactly `pro` (`PRO_PLAN_SLUG`),
 * paid by a user (`data.payer.user_id`), change `accounts.plan`:
 *
 * | Event                                            | accounts.plan                                         |
 * | ------------------------------------------------ | ----------------------------------------------------- |
 * | `subscriptionItem.active`                        | `pro`                                                 |
 * | `subscriptionItem.canceled`                      | unchanged until the paid period ends (`ended` follows); `free` if `period_end` already passed |
 * | `subscriptionItem.ended`, `subscriptionItem.expired` | `free`                                            |
 * | any other `subscriptionItem.*`, other event types | unchanged (200, ignored)                              |
 *
 * Other plan slugs (e.g. Clerk's `free_user`) are ignored: on an upgrade Clerk ends the Free item,
 * which must not downgrade the new Pro owner. In the Clerk dashboard, subscribe the endpoint to at
 * least `subscriptionItem.active`, `.canceled`, `.ended` and `.expired`.
 */
export async function POST(request: NextRequest) {
  if (!process.env.CLERK_WEBHOOK_SIGNING_SECRET) {
    // A missing secret is our config problem, not a bad sender: 500 so Clerk retries once it's set.
    return internalError("POST /api/clerk/webhook", new Error("CLERK_WEBHOOK_SIGNING_SECRET is not set"));
  }

  let event;
  try {
    event = await verifyWebhook(request);
  } catch {
    // Never touch the database for an unverified request.
    return apiError(401, "unauthorized", "Invalid webhook signature.");
  }

  const decision = planDecisionForEvent(event);
  if (decision.action === "set") {
    try {
      await setAccountPlan(decision.userId, decision.plan);
    } catch (error) {
      return internalError("POST /api/clerk/webhook", error);
    }
  }
  // Log the event type and outcome only; the payload holds personal data (email, name).
  console.info("[clerk/webhook]", event.type, decision.action, decision.reason);
  return NextResponse.json({ received: true }, { headers: { "Cache-Control": "no-store" } });
}
