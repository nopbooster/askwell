import "server-only";
import { after } from "next/server";
import { captureServer } from "../posthog/server";
import type { ProductEvent, ProductEvents } from "./events";

/**
 * Sends a product event from the server, identified by the Clerk user ID.
 * Runs after the response (`after()`), so it adds no latency, and it never throws:
 * a failing capture can't change a route's result.
 */
export function trackServer<E extends ProductEvent>(event: E, clerkUserId: string, properties: ProductEvents[E]): void {
  // captureServer already never throws; the catch keeps that true even if it changes.
  const send = () => captureServer(event, clerkUserId, properties).catch(() => undefined);
  try {
    after(send);
  } catch {
    // Outside a request scope (scripts, tests): send now, still without throwing.
    void send();
  }
}
