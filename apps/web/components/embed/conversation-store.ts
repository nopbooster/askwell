import { APP_NAME, UuidSchema } from "@askwell/shared";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** One conversation per public key, for this browser session (the iframe's sessionStorage). */
export function conversationStorageKey(publicKey: string): string {
  return `${APP_NAME.toLowerCase()}-conversation-${publicKey}`;
}

function sessionStore(): StorageLike | null {
  try {
    return window.sessionStorage; // reading it can throw (blocked storage)
  } catch {
    return null;
  }
}

/** The stored conversation id, or undefined. Never throws; ignores a value that isn't a UUID. */
export function loadConversationId(
  publicKey: string,
  storage: StorageLike | null = sessionStore(),
): string | undefined {
  try {
    const value = storage?.getItem(conversationStorageKey(publicKey));
    const parsed = UuidSchema.safeParse(value);
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export function saveConversationId(
  publicKey: string,
  conversationId: string,
  storage: StorageLike | null = sessionStore(),
): void {
  try {
    storage?.setItem(conversationStorageKey(publicKey), conversationId);
  } catch {
    /* storage is full or blocked: the panel still keeps it in memory */
  }
}

export function clearConversationId(
  publicKey: string,
  storage: StorageLike | null = sessionStore(),
): void {
  try {
    storage?.removeItem(conversationStorageKey(publicKey));
  } catch {
    /* ignore */
  }
}
