import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextResponse, type NextRequest } from "next/server";
import { apiError, internalError } from "../../../../lib/api/http";
import { setAccountPlan } from "../../../../lib/billing/accounts";
import { currentPlanFromClerk } from "../../../../lib/billing/clerk";
import { planDecisionForEvent } from "../../../../lib/billing";

/**
 * POST /api/clerk/webhook: Clerk Billing → `accounts.plan` (project.md §6.10, §8 System).
 * Public (no Clerk session); the Svix signature is the only check and runs before anything else.
 * 2xx tells Clerk it's handled; a 5xx makes Clerk retry.
 *
 * Events are triggers, not the truth (docs/phase6-security-review.md §3): Svix retries and delivers
 * out of order, so a late `subscriptionItem.ended` (or `.active`) for an old item must not decide
 * the plan. For every verified `subscriptionItem.*` event paid by a user (`planDecisionForEvent`),
 * the route reads the user's CURRENT subscription from Clerk's Backend API and writes the plan
 * it implies (`planFromSubscription`):
 *
 * | Current Clerk subscription                                        | accounts.plan |
 * | ----------------------------------------------------------------- | ------------- |
 * | a `pro` item that is `active` or `past_due`                       | `pro`         |
 * | a `pro` item that is `canceled` with its paid period still running | `pro`         |
 * | anything else (Free only, ended/expired Pro, no subscription)     | `free`        |
 *
 * If Clerk's API fails, the route answers 500 and writes nothing, so Svix retries.
 * In the Clerk dashboard, subscribe the endpoint to at least `subscriptionItem.active`,
 * `.canceled`, `.ended` and `.expired`.
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
  let outcome: string = decision.action;
  if (decision.action === "sync") {
    let plan;
    try {
      plan = await currentPlanFromClerk(decision.userId);
    } catch (error) {
      // No truth, no write: Svix retries the delivery.
      return internalError("POST /api/clerk/webhook", error);
    }
    try {
      await setAccountPlan(decision.userId, plan);
    } catch (error) {
      return internalError("POST /api/clerk/webhook", error);
    }
    outcome = `sync → ${plan}`;
  }
  // Log the delivery id, event type and outcome only; the payload holds personal data (email, name).
  // The svix-id matches the message id in Clerk's dashboard (Webhooks → endpoint → Message attempts).
  console.info("[clerk/webhook]", request.headers.get("svix-id") ?? "-", event.type, outcome, decision.reason);
  return NextResponse.json({ received: true }, { headers: { "Cache-Control": "no-store" } });
}
