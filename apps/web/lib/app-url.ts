import { headers } from "next/headers";

type HeaderReader = { get(name: string): string | null };

/** Parses an origin. Only http(s), no path/query; returns `null` for anything else. */
function toOrigin(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** First value of a possibly comma-separated forwarded header. */
function first(value: string | null): string | null {
  const v = value?.split(",")[0]?.trim();
  return v ? v : null;
}

/**
 * Pure: the app's base URL (no trailing slash).
 * `NEXT_PUBLIC_APP_URL` wins when set (production). Otherwise the request's own origin, so each
 * Vercel preview shows its own URL. Returns `null` when neither gives a valid origin.
 */
export function resolveAppUrl(envUrl: string | undefined, h: HeaderReader): string | null {
  const fromEnv = toOrigin(envUrl);
  if (fromEnv) return fromEnv;
  const host = first(h.get("x-forwarded-host")) ?? first(h.get("host"));
  if (!host) return null;
  const proto = first(h.get("x-forwarded-proto"));
  const scheme = proto === "http" || proto === "https" ? proto : /^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https";
  return toOrigin(`${scheme}://${host}`);
}

/** Server only: the base URL for the current request. Throws when none can be determined. */
export async function getAppUrl(): Promise<string> {
  const url = resolveAppUrl(process.env.NEXT_PUBLIC_APP_URL, await headers());
  if (!url) throw new Error("getAppUrl: no NEXT_PUBLIC_APP_URL and no usable Host header");
  return url;
}
