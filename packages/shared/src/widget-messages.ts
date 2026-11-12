import { z } from "zod";
import { APP_NAME } from "./index";

/**
 * postMessage protocol between the panel (`/embed`, inside the iframe) and the loader
 * (`widget.js`, on the customer's site). Panel → loader only.
 *
 * Every message carries a `source` tag and a `version`. Receivers must still check
 * `event.origin` and `event.source`; this format is only the second line of defence.
 */

export const WIDGET_MESSAGE_VERSION = 1;

/** Tag on every message, built from APP_NAME (e.g. "askwell-widget"). Call, don't cache at import time. */
export function widgetMessageSource(): string {
  return `${APP_NAME.toLowerCase()}-widget`;
}

export const WIDGET_MESSAGE_TYPES = [
  "ready",
  "close",
  "resize",
  "unread",
] as const;
export type WidgetMessageType = (typeof WIDGET_MESSAGE_TYPES)[number];

/** Panel height limits for `resize`, in CSS pixels. */
export const WIDGET_RESIZE_MIN_HEIGHT = 1;
export const WIDGET_RESIZE_MAX_HEIGHT = 5000;
export const WIDGET_UNREAD_MAX = 999;

export type WidgetMessage =
  | { source: string; version: number; type: "ready" }
  | { source: string; version: number; type: "close" }
  | { source: string; version: number; type: "resize"; height: number }
  | { source: string; version: number; type: "unread"; count: number };

/**
 * Zod schema for the same format (for the panel and tests). A function, not a constant, so the
 * loader bundle can drop it: the loader does NOT use zod, because zod would blow its 5 KB budget; it uses `parseWidgetMessage`, which is hand-written
 * and checked against this schema in the tests.
 */
export const getWidgetMessageSchema = () =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("ready") }),
    z.object({ type: z.literal("close") }),
    z.object({
      type: z.literal("resize"),
      height: z
        .number()
        .int()
        .min(WIDGET_RESIZE_MIN_HEIGHT)
        .max(WIDGET_RESIZE_MAX_HEIGHT),
    }),
    z.object({
      type: z.literal("unread"),
      count: z.number().int().min(0).max(WIDGET_UNREAD_MAX),
    }),
  ]);

/** Builds a valid message (panel side). */
export function createWidgetMessage(
  message:
    | { type: "ready" }
    | { type: "close" }
    | { type: "resize"; height: number }
    | { type: "unread"; count: number },
): WidgetMessage {
  return {
    source: widgetMessageSource(),
    version: WIDGET_MESSAGE_VERSION,
    ...message,
  };
}

function isInt(value: unknown, min: number, max: number): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}

/** Returns the message, or null for anything that is not exactly our format. Never throws. */
export function parseWidgetMessage(data: unknown): WidgetMessage | null {
  if (typeof data !== "object" || data === null || Array.isArray(data))
    return null;
  const m = data as Record<string, unknown>;
  if (
    m.source !== widgetMessageSource() ||
    m.version !== WIDGET_MESSAGE_VERSION
  )
    return null;
  const { source, version } = m as { source: string; version: number };
  switch (m.type) {
    case "ready":
    case "close":
      return { source, version, type: m.type };
    case "resize":
      return isInt(m.height, WIDGET_RESIZE_MIN_HEIGHT, WIDGET_RESIZE_MAX_HEIGHT)
        ? { source, version, type: "resize", height: m.height }
        : null;
    case "unread":
      return isInt(m.count, 0, WIDGET_UNREAD_MAX)
        ? { source, version, type: "unread", count: m.count }
        : null;
    default:
      return null;
  }
}
