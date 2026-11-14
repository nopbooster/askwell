"use client";

import { useState } from "react";
import { APP_NAME, type WidgetConfig } from "@askwell/shared";
import { isHexColor, textOn } from "./color";

/** Entry state for each animation (`@starting-style`): the panel transitions from here when it mounts. */
function entryClasses(animation: WidgetConfig["animation"], fromTop: boolean): string {
  if (animation === "slide") return fromTop ? "starting:opacity-0 starting:-translate-y-6" : "starting:opacity-0 starting:translate-y-6";
  if (animation === "scale") return "starting:opacity-0 starting:scale-90";
  return "starting:opacity-0";
}

/**
 * A mock of the widget (button, panel header, badge) drawn from the unsaved form values.
 * Every value is rendered as text or a CSS value, never as HTML.
 */
export function WidgetPreview({ config }: { config: WidgetConfig }) {
  const [v, h] = config.position.split("-") as ["top" | "bottom", "left" | "right"];
  const color = isHexColor(config.buttonColor) ? config.buttonColor : "#0a0a0a";
  // The panel remounts (new key) when the animation or corner changes, or on Replay, which plays its entry.
  const [run, setRun] = useState(0);

  return (
    <div>
      <div
        data-testid="widget-preview"
        className="relative h-96 overflow-hidden rounded-panel border border-line bg-[repeating-linear-gradient(45deg,var(--surface)_0_12px,transparent_12px_24px)]"
        aria-label="Widget preview"
        role="img"
      >
        <div
          key={`${config.animation}-${config.position}-${run}`}
          data-testid="preview-panel"
          data-animation={config.animation}
          className={`absolute w-64 max-w-[calc(100%-2rem)] overflow-hidden rounded-2xl bg-white text-[#09090b] opacity-100 shadow-glass transition duration-200 motion-reduce:transition-none ${
            v === "top" ? "top-[4.5rem]" : "bottom-[4.5rem]"
          } ${h === "left" ? "left-4" : "right-4"} ${entryClasses(config.animation, v === "top")}`}
          style={{ transformOrigin: `${v} ${h}` }}
        >
          <div className="border-b border-black/10 px-3 py-2.5 text-sm font-semibold" data-testid="preview-header">
            {config.headerText}
          </div>
          <div className="space-y-2 px-3 py-3">
            <div className="h-2.5 w-3/4 rounded bg-black/10" />
            <div className="ml-auto h-2.5 w-1/2 rounded bg-black/80" />
          </div>
          {config.showBadge ? (
            <p className="px-3 pb-2 text-[11px] text-black/50" data-testid="preview-badge">
              Powered by {APP_NAME}
            </p>
          ) : null}
        </div>
        <span
          data-testid="preview-button"
          className={`absolute flex h-12 max-w-[calc(100%-2rem)] items-center truncate rounded-full px-5 text-sm font-semibold shadow-raised ${
            v === "top" ? "top-3" : "bottom-3"
          } ${h === "left" ? "left-4" : "right-4"}`}
          style={{ background: color, color: textOn(color) }}
        >
          {config.label}
        </span>
      </div>
      <button
        type="button"
        onClick={() => setRun((n) => n + 1)}
        className="mt-2 text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline"
      >
        Replay the open animation
      </button>
    </div>
  );
}
