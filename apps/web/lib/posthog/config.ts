import type { PosthogConfigResponse } from "@askwell/shared";

/**
 * PostHog's public project key and host, read from the environment at request time (not build time),
 * so one build serves every environment. Both are public by design; no secret lives here.
 * Returns null when either is missing or the host is not an http(s) URL.
 */
export function readPosthogConfig(
  env: Record<string, string | undefined> = process.env,
): PosthogConfigResponse | null {
  const key = env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  const host = env.NEXT_PUBLIC_POSTHOG_HOST?.trim().replace(/\/+$/, "");
  if (!key || !host) return null;
  try {
    const url = new URL(host);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  } catch {
    return null;
  }
  return { key, host };
}
