"use client";

import posthog from "posthog-js";
import { initPostHog } from "../posthog/client";
import type { ProductEvent, ProductEvents } from "./events";

/**
 * Sends a product event from the browser, identified by the Clerk user ID so it joins the same
 * person as the server events. A no-op when PostHog isn't configured. Never throws.
 */
export async function trackClient<E extends ProductEvent>(
  event: E,
  clerkUserId: string | null | undefined,
  properties: ProductEvents[E],
): Promise<void> {
  try {
    if (!(await initPostHog())) return;
    if (clerkUserId && posthog.get_distinct_id() !== clerkUserId) posthog.identify(clerkUserId);
    posthog.capture(event, properties);
  } catch {
    // Analytics must never break the UI.
  }
}
