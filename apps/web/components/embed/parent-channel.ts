import { createWidgetMessage, type WidgetMessage } from "@askwell/shared";

type PostArg = Parameters<typeof createWidgetMessage>[0];

type ParentWindow = {
  postMessage: (message: unknown, targetOrigin: string) => void;
};
type ChannelWindow = {
  parent: ParentWindow;
  addEventListener: (
    type: "message",
    listener: (e: MessageEvent) => void,
  ) => void;
  removeEventListener: (
    type: "message",
    listener: (e: MessageEvent) => void,
  ) => void;
};

/** True only for a message from the parent window, at the origin the loader told us about. */
export function isTrustedParentMessage(
  event: Pick<MessageEvent, "origin" | "source">,
  parentOrigin: string | null,
  parentWindow: unknown,
): boolean {
  return (
    parentOrigin !== null &&
    event.origin === parentOrigin &&
    event.source === parentWindow
  );
}

export type ParentChannel = {
  /** Sends a protocol message to the parent. Does nothing without a valid parent origin. */
  post: (message: PostArg) => WidgetMessage | null;
  dispose: () => void;
};

/**
 * Talks to the loader (panel → loader), always with `targetOrigin = parentOrigin`, never "*".
 * No valid origin, or not inside a frame: every post is a no-op. Messages coming from anywhere
 * but the parent at that origin are dropped before `onMessage` sees them.
 */
export function createParentChannel(
  win: ChannelWindow,
  parentOrigin: string | null,
  onMessage?: (data: unknown) => void,
): ParentChannel {
  const inFrame = (win.parent as unknown) !== (win as unknown);
  const listener = (e: MessageEvent) => {
    if (isTrustedParentMessage(e, parentOrigin, win.parent))
      onMessage?.(e.data);
  };
  if (onMessage) win.addEventListener("message", listener);
  return {
    post(message) {
      if (parentOrigin === null || !inFrame) return null;
      const msg = createWidgetMessage(message);
      win.parent.postMessage(msg, parentOrigin);
      return msg;
    },
    dispose() {
      if (onMessage) win.removeEventListener("message", listener);
    },
  };
}
