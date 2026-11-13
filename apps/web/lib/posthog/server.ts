import "server-only";
import { PostHog } from "posthog-node";
import { readPosthogConfig } from "./config";

let client: PostHog | null | undefined;

/** The server client (posthog-node), or null when analytics is not configured. Built on first use. */
function getClient(): PostHog | null {
  if (client !== undefined) return client;
  const config = readPosthogConfig();
  client = config
    ? // Serverless: send each event at once; a short timeout keeps telemetry from slowing a request.
      new PostHog(config.key, {
        host: config.host,
        flushAt: 1,
        flushInterval: 0,
        requestTimeout: 2_000,
        fetchRetryCount: 0,
      })
    : null;
  return client;
}

/**
 * Capture a product event from the server. Awaitable and never throws.
 * Never pass message text or other visitor content in `properties`.
 */
export async function captureServer(
  event: string,
  distinctId: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  try {
    await getClient()?.captureImmediate({ distinctId, event, properties });
  } catch {
    // Telemetry must never change a route's result.
  }
}

/** Capture a server error in PostHog error tracking. Awaitable and never throws. */
export async function captureServerException(
  error: unknown,
  distinctId?: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  try {
    await getClient()?.captureExceptionImmediate(error, distinctId, properties);
  } catch {
    // Telemetry must never change a route's result.
  }
}
