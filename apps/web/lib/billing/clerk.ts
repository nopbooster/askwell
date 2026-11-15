import "server-only";
import type { Plan } from "@askwell/shared";
import { clerkClient } from "@clerk/nextjs/server";
import { planFromSubscription } from "./plan-event";

/**
 * The user's plan according to Clerk Billing right now (Backend API, `CLERK_SECRET_KEY`).
 * A user without any subscription (Clerk answers 404) is Free. Any other failure throws, so the
 * webhook answers 500 and Svix retries; nothing is written.
 */
export async function currentPlanFromClerk(userId: string, now: number = Date.now()): Promise<Plan> {
  try {
    const subscription = await (await clerkClient()).billing.getUserBillingSubscription(userId);
    return planFromSubscription(subscription.subscriptionItems, now);
  } catch (error) {
    if ((error as { status?: unknown } | null)?.status === 404) return "free";
    throw error;
  }
}
