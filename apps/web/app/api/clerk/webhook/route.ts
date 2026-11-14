import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextResponse, type NextRequest } from "next/server";
import { apiError, internalError } from "../../../../lib/api/http";
import { setAccountPlan } from "../../../../lib/billing/accounts";
import { planDecisionForEvent } from "../../../../lib/billing";

/**
 * POST /api/clerk/webhook: Clerk Billing → `accounts.plan` (project.md §6.10, §8 System).
 * Public (no Clerk session); the Svix signature is the only check and runs before anything else.
 * 2xx tells Clerk it's handled; a 5xx makes Clerk retry.
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
