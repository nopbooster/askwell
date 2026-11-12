import "server-only";
import arcjet, { detectPromptInjection as promptInjectionRule, fixedWindow } from "@arcjet/next";
import { CHAT_RATE_LIMIT } from "@askwell/shared";

/** Public widget routes protected by Arcjet. */
export type WidgetRoute = "chat" | "config";

/** Config is read on every page load of a customer site, so it gets a higher limit than chat. */
export const CONFIG_RATE_LIMIT = { max: 60, windowSeconds: 60 } as const;

const LIMITS: Record<WidgetRoute, { max: number; windowSeconds: number }> = {
  chat: CHAT_RATE_LIMIT,
  config: CONFIG_RATE_LIMIT,
};

/** The routes map these to errors: 429 `rate_limited`, 400 `message_blocked`. */
export type ProtectResult =
  { status: "allowed" } | { status: "rate_limited" } | { status: "injection" };

const ALLOWED: ProtectResult = { status: "allowed" };

const client = arcjet({
  key: process.env.ARCJET_KEY ?? "",
  // Arcjet's own default is ["ip.src"]; per rule we key by route + public key + IP.
  rules: [],
});

// Built once at module scope so the clones share the decision cache.
const limiters = {
  chat: client.withRule(limitRule("chat")),
  config: client.withRule(limitRule("config")),
};
const injectionDetector = client.withRule(promptInjectionRule({ mode: "LIVE" }));

function limitRule(route: WidgetRoute) {
  const { max, windowSeconds } = LIMITS[route];
  return fixedWindow({
    mode: "LIVE",
    window: `${windowSeconds}s`,
    max,
    characteristics: ["route", "publicKey", "ip.src"],
  });
}

function warn(what: string, error?: unknown) {
  // Never log request content. Only the kind of failure.
  console.warn(
    `[arcjet] ${what}; letting the request through`,
    error instanceof Error ? error.name : "",
  );
}

/**
 * Fixed-window rate limit keyed by route + public key + client IP.
 * Fails open: an Arcjet error or timeout allows the request and logs a warning.
 */
export async function protectWidgetRequest(
  req: Request,
  { route, publicKey }: { route: WidgetRoute; publicKey: string },
): Promise<ProtectResult> {
  try {
    const decision = await limiters[route].protect(req, { route, publicKey });
    if (decision.isErrored()) {
      warn("rate limit check errored");
      return ALLOWED;
    }
    if (decision.isDenied() && decision.reason.isRateLimit()) return { status: "rate_limited" };
    return ALLOWED;
  } catch (error) {
    warn("rate limit check failed", error);
    return ALLOWED;
  }
}

/**
 * Prompt injection check for a visitor's chat message, before any AI call.
 * Fails open. The message text is sent to Arcjet only; it is never logged.
 */
export async function detectPromptInjection(req: Request, message: string): Promise<ProtectResult> {
  try {
    const decision = await injectionDetector.protect(req, {
      detectPromptInjectionMessage: message,
    });
    if (decision.isErrored()) {
      warn("injection check errored");
      return ALLOWED;
    }
    if (decision.isDenied() && decision.reason.isPromptInjection()) return { status: "injection" };
    return ALLOWED;
  } catch (error) {
    warn("injection check failed", error);
    return ALLOWED;
  }
}
