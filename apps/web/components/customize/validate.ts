import { MAX_WIDGET_HEADER_CHARS, MAX_WIDGET_LABEL_CHARS, type WidgetConfig } from "@askwell/shared";
import { isHexColor } from "./color";

export type ConfigErrors = Partial<Record<"buttonColor" | "label" | "headerText", string>>;

/** Client-side hints only. The server validates again and decides. */
export function validateConfig(config: WidgetConfig): ConfigErrors {
  const errors: ConfigErrors = {};
  if (!isHexColor(config.buttonColor)) errors.buttonColor = "Use a hex color like #0a0a0a.";
  const label = config.label.trim();
  if (!label || label.length > MAX_WIDGET_LABEL_CHARS) errors.label = `1 to ${MAX_WIDGET_LABEL_CHARS} characters.`;
  const header = config.headerText.trim();
  if (!header || header.length > MAX_WIDGET_HEADER_CHARS) errors.headerText = `1 to ${MAX_WIDGET_HEADER_CHARS} characters.`;
  return errors;
}

export function sameConfig(a: WidgetConfig, b: WidgetConfig): boolean {
  return (Object.keys(a) as (keyof WidgetConfig)[]).every((k) => a[k] === b[k]);
}
