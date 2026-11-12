import { APP_NAME, MAX_VISITOR_ID_CHARS } from "@askwell/shared";

/** Where the visitor ID lives in the iframe's localStorage. Built from APP_NAME. */
export const VISITOR_ID_STORAGE_KEY = `${APP_NAME.toLowerCase()}-visitor-id`;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const VALID = new RegExp(`^[A-Za-z0-9_-]{1,${MAX_VISITOR_ID_CHARS}}$`);

// Used when storage is unavailable (blocked cookies, private mode): same ID for this page view.
let memoryId: string | null = null;

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    return crypto.randomUUID();
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Test helper: forget the in-memory fallback. */
export function resetVisitorIdMemory(): void {
  memoryId = null;
}

/**
 * A random ID stored in localStorage and reused across visits. If storage throws (on access,
 * read or write), falls back to an ID kept in memory. Never throws.
 */
export function getVisitorId(storage?: StorageLike | null): string {
  let store: StorageLike | null = null;
  try {
    store = storage === undefined ? window.localStorage : storage;
  } catch {
    store = null; // reading window.localStorage can itself throw
  }
  if (store) {
    try {
      const existing = store.getItem(VISITOR_ID_STORAGE_KEY);
      if (existing && VALID.test(existing)) return existing;
    } catch {
      /* fall through to a new ID */
    }
  }
  const id = memoryId ?? generateId();
  if (store) {
    try {
      store.setItem(VISITOR_ID_STORAGE_KEY, id);
      memoryId = null;
      return id;
    } catch {
      /* storage is full or blocked */
    }
  }
  memoryId = id;
  return id;
}
