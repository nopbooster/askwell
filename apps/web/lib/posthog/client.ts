"use client";

import posthog from "posthog-js";
import { PosthogConfigResponseSchema } from "@askwell/shared";

let initPromise: Promise<boolean> | undefined;
let ready = false;

/**
 * Starts PostHog once, with the key and host fetched from /api/posthog-config at runtime.
 * Resolves false (and stays silent) when analytics is not configured or the fetch fails.
 */
export function initPostHog(): Promise<boolean> {
  initPromise ??= (async () => {
    try {
      const res = await fetch("/api/posthog-config", { cache: "no-store" });
      if (!res.ok) return false;
      const config = PosthogConfigResponseSchema.parse(await res.json());
      posthog.init(config.key, {
        api_host: config.host,
        defaults: "2026-08-30",
        person_profiles: "identified_only",
        capture_exceptions: true,
        // Replay starts per route (see PostHogProvider). Product owner decision: record everything,
        // including visitor text on Conversations, so nothing is masked. PostHog still never records password fields.
        disable_session_recording: true,
        session_recording: { maskAllInputs: false, maskTextSelector: undefined },
      });
      ready = true;
      return true;
    } catch {
      return false;
    }
  })();
  return initPromise;
}

export function setReplay(on: boolean): void {
  if (!ready) return;
  if (on) posthog.startSessionRecording();
  else posthog.stopSessionRecording();
}

/**
 * Capture a product event from the browser. Safe to call anywhere: a no-op until PostHog is running.
 * Never pass message text or other visitor content in `properties`.
 */
export function capture(event: string, properties?: Record<string, unknown>): void {
  if (!ready) return;
  posthog.capture(event, properties);
}
