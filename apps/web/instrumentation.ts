import type { Instrumentation } from "next";

/** Server error tracking: every error Next.js catches in a route, page or action goes to PostHog. */
export const onRequestError: Instrumentation.onRequestError = async (error, request) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { captureServerException } = await import("./lib/posthog/server");
  // Tie it to the browser session when the PostHog cookie is present; otherwise it is anonymous.
  const cookie = Array.isArray(request.headers.cookie)
    ? request.headers.cookie.join(";")
    : (request.headers.cookie ?? "");
  const match = /ph_phc_[^=]*_posthog=([^;]+)/.exec(cookie);
  let distinctId: string | undefined;
  try {
    const parsed: unknown = match?.[1] ? JSON.parse(decodeURIComponent(match[1])) : undefined;
    const id = (parsed as { distinct_id?: unknown } | undefined)?.distinct_id;
    if (typeof id === "string") distinctId = id;
  } catch {
    // Unreadable cookie: send it anonymously.
  }
  await captureServerException(error, distinctId, { path: request.path, method: request.method });
};
