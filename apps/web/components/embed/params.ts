import { PUBLIC_KEY_REGEX } from "@askwell/shared";

/**
 * The parent page's origin, only when it is a plain http(s) origin (no path, no "null").
 * It is the one place the panel is allowed to talk to, so be strict.
 */
export function parseParentOrigin(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin === value ? value : null;
  } catch {
    return null;
  }
}

type RawParam = string | string[] | undefined;
const first = (v: RawParam) => (Array.isArray(v) ? v[0] : v);

/** Reads `key` and `origin` from the /embed query. A bad key is null; a bad origin is null. */
export function readEmbedParams(searchParams: Record<string, RawParam>): {
  key: string | null;
  origin: string | null;
} {
  const key = first(searchParams.key) ?? "";
  return {
    key: PUBLIC_KEY_REGEX.test(key) ? key : null,
    origin: parseParentOrigin(first(searchParams.origin)),
  };
}
