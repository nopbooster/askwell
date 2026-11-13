"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { initPostHog, setReplay } from "./client";
import { isEmbedPath, isReplayPath } from "./paths";

/** Starts PostHog in the browser. Does nothing on /embed (the widget iframe on customers' sites). */
export function PostHogProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const embed = isEmbedPath(pathname);
  const replay = isReplayPath(pathname);

  useEffect(() => {
    if (embed) return;
    let cancelled = false;
    void initPostHog().then((ok) => {
      if (ok && !cancelled) setReplay(replay);
    });
    return () => {
      cancelled = true;
    };
  }, [embed, replay]);

  return <>{children}</>;
}
