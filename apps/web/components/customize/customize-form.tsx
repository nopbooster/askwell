"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import {
  APP_NAME,
  MAX_WIDGET_HEADER_CHARS,
  MAX_WIDGET_LABEL_CHARS,
  WIDGET_ANIMATIONS,
  WIDGET_POSITIONS,
  type Plan,
  type UpdateConfigResponse,
  type WidgetConfig,
} from "@askwell/shared";
import { callApi } from "../projects/api";
import { Button, GlassPanel } from "../ui";
import { isHexColor } from "./color";
import { LockedNotice } from "./locked-notice";
import { WidgetPreview } from "./preview";
import { sameConfig, validateConfig } from "./validate";

const FIELD =
  "glass w-full rounded-control px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:cursor-not-allowed disabled:opacity-60";

const POSITION_LABELS: Record<WidgetConfig["position"], string> = {
  "bottom-right": "Bottom right",
  "bottom-left": "Bottom left",
  "top-right": "Top right",
  "top-left": "Top left",
};
const ANIMATION_LABELS: Record<WidgetConfig["animation"], string> = { fade: "Fade", slide: "Slide", scale: "Scale" };

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export type CustomizeFormProps = {
  projectId: string;
  /** Read on the server. It only decides how the form looks; the server decides what saves. */
  plan: Plan;
  initialConfig: WidgetConfig;
};

export function CustomizeForm({ projectId, plan, initialConfig }: CustomizeFormProps) {
  const ids = useId();
  const [saved, setSaved] = useState(initialConfig);
  const [config, setConfig] = useState(initialConfig);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // A 402 from the server locks the form too (e.g. the plan changed since the page loaded).
  const [serverLock, setServerLock] = useState<string | null>(null);

  const locked = plan !== "pro" || serverLock !== null;
  const errors = validateConfig(config);
  const invalid = Object.keys(errors).length > 0;
  const dirty = !sameConfig(config, saved);

  const set = <K extends keyof WidgetConfig>(key: K, value: WidgetConfig[K]) => {
    setConfig((c) => ({ ...c, [key]: value }));
    if (status.kind !== "saving") setStatus({ kind: "idle" });
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (locked || invalid || !dirty || status.kind === "saving") return;
    setStatus({ kind: "saving" });
    const result = await callApi<UpdateConfigResponse>("PATCH", `/api/projects/${projectId}/config`, {
      ...config,
      label: config.label.trim(),
      headerText: config.headerText.trim(),
    });
    if (result.ok) {
      setSaved(result.data.config);
      setConfig(result.data.config);
      setStatus({ kind: "saved" });
    } else if (result.status === 402) {
      setServerLock(result.message);
      setStatus({ kind: "idle" });
    } else {
      setStatus({ kind: "error", message: result.message });
    }
  }

  return (
    <div className="space-y-4">
      {locked ? <LockedNotice message={serverLock ?? undefined} /> : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <GlassPanel className="p-4 sm:p-5">
          <form onSubmit={onSubmit} noValidate aria-label="Widget settings">
            <fieldset disabled={locked} className="space-y-4" data-testid="customize-fields">
              <Field id={`${ids}-color`} label="Button color" error={errors.buttonColor}>
                <div className="flex gap-2">
                  <input
                    type="color"
                    aria-label="Pick a button color"
                    value={isHexColor(config.buttonColor) ? config.buttonColor : "#0a0a0a"}
                    onChange={(e) => set("buttonColor", e.target.value)}
                    className="h-10 w-12 shrink-0 cursor-pointer rounded-control border border-line bg-transparent p-1 disabled:cursor-not-allowed"
                  />
                  <input
                    id={`${ids}-color`}
                    value={config.buttonColor}
                    onChange={(e) => set("buttonColor", e.target.value.trim())}
                    maxLength={7}
                    spellCheck={false}
                    autoComplete="off"
                    className={`${FIELD} min-h-10 font-mono`}
                  />
                </div>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field id={`${ids}-position`} label="Button position">
                  <select
                    id={`${ids}-position`}
                    value={config.position}
                    onChange={(e) => set("position", e.target.value as WidgetConfig["position"])}
                    className={`${FIELD} min-h-10`}
                  >
                    {WIDGET_POSITIONS.map((p) => (
                      <option key={p} value={p}>
                        {POSITION_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id={`${ids}-animation`} label="Open animation">
                  <select
                    id={`${ids}-animation`}
                    value={config.animation}
                    onChange={(e) => set("animation", e.target.value as WidgetConfig["animation"])}
                    className={`${FIELD} min-h-10`}
                  >
                    {WIDGET_ANIMATIONS.map((a) => (
                      <option key={a} value={a}>
                        {ANIMATION_LABELS[a]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field id={`${ids}-label`} label="Button label" error={errors.label}>
                <input
                  id={`${ids}-label`}
                  value={config.label}
                  onChange={(e) => set("label", e.target.value)}
                  maxLength={MAX_WIDGET_LABEL_CHARS}
                  autoComplete="off"
                  className={`${FIELD} min-h-10`}
                />
              </Field>

              <Field id={`${ids}-header`} label="Panel header" error={errors.headerText}>
                <input
                  id={`${ids}-header`}
                  value={config.headerText}
                  onChange={(e) => set("headerText", e.target.value)}
                  maxLength={MAX_WIDGET_HEADER_CHARS}
                  autoComplete="off"
                  className={`${FIELD} min-h-10`}
                />
              </Field>

              <label className="flex min-h-10 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={config.showBadge}
                  onChange={(e) => set("showBadge", e.target.checked)}
                  className="size-4 accent-[var(--accent)]"
                />
                Show the &quot;Powered by {APP_NAME}&quot; badge
              </label>
            </fieldset>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={locked || invalid || !dirty || status.kind === "saving"}>
                {status.kind === "saving" ? "Saving…" : "Save"}
              </Button>
              {dirty && !locked ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setConfig(saved);
                    setStatus({ kind: "idle" });
                  }}
                >
                  Undo changes
                </Button>
              ) : null}
              <span role="status" aria-live="polite" className="text-sm text-fg-muted">
                {status.kind === "saved" ? "Saved. Reload your site to see the new look." : ""}
              </span>
            </div>
            {status.kind === "error" ? (
              <p role="alert" className="mt-3 text-sm text-danger">
                {status.message}
              </p>
            ) : null}
          </form>
        </GlassPanel>

        <GlassPanel className="p-4 sm:p-5">
          <h2 className="mb-3 text-base font-medium">Preview</h2>
          <WidgetPreview config={config} />
        </GlassPanel>
      </div>
    </div>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
