"use client";

import type { ThemePreference } from "./theme";
import { setPreference, usePreference } from "./use-theme";

const OPTIONS: readonly { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export function ThemeToggle() {
  const current = usePreference();
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="flex rounded-control border border-line p-0.5"
    >
      {OPTIONS.map(({ value, label }) => {
        const checked = current === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => setPreference(value)}
            className={`min-h-8 flex-1 rounded-[0.45rem] px-2 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-fg ${
              checked ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
