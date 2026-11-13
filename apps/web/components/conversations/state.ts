import type { GetConversationResponse } from "@askwell/shared";
import type { FetchResult } from "./api";

export type ThreadState =
  | { status: "idle" }
  | { status: "loading"; id: string }
  | { status: "ready"; id: string; thread: GetConversationResponse }
  | { status: "missing"; id: string }
  | { status: "error"; id: string };

/**
 * What the thread pane shows while a refresh re-reads it. A loaded thread stays on screen (no flash
 * of the loading skeleton); anything else shows the skeleton.
 */
export function threadWhileRefreshing(current: ThreadState, id: string): ThreadState {
  return current.status === "ready" && current.id === id ? current : { status: "loading", id };
}

/**
 * The thread pane after a read of thread `id`. A failed refresh keeps a thread that is already on
 * screen (the page shows "Couldn't refresh" instead); a deleted one (404) always shows as missing.
 */
export function nextThreadState(
  current: ThreadState,
  id: string,
  result: FetchResult<GetConversationResponse>,
  keepVisible: boolean,
): ThreadState {
  if (result.ok) return { status: "ready", id, thread: result.data };
  if (result.notFound) return { status: "missing", id };
  if (keepVisible && current.status === "ready" && current.id === id) return current;
  return { status: "error", id };
}
