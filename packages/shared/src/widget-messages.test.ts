import { describe, expect, it } from "vitest";
import {
  WIDGET_MESSAGE_VERSION,
  getWidgetMessageSchema,
  createWidgetMessage,
  parseWidgetMessage,
  widgetMessageSource,
} from "./index";

const base = { source: widgetMessageSource(), version: WIDGET_MESSAGE_VERSION };

describe("widgetMessageSource", () => {
  it("is built from APP_NAME", () => {
    expect(widgetMessageSource()).toBe("askwell-widget");
  });
});

describe("parseWidgetMessage", () => {
  it("accepts every message type", () => {
    for (const msg of [
      { ...base, type: "ready" },
      { ...base, type: "close" },
      { ...base, type: "resize", height: 480 },
      { ...base, type: "unread", count: 0 },
      { ...base, type: "unread", count: 3 },
    ]) {
      expect(parseWidgetMessage(msg)).toEqual(msg);
    }
  });

  it("round-trips createWidgetMessage", () => {
    const msg = createWidgetMessage({ type: "resize", height: 300 });
    expect(parseWidgetMessage(msg)).toEqual(msg);
  });

  it("rejects junk", () => {
    const junk: unknown[] = [
      null,
      undefined,
      "close",
      42,
      [],
      {},
      { type: "close" },
      { ...base, type: "nope" },
      { ...base },
      { ...base, source: "other-widget", type: "close" },
      { ...base, version: 2, type: "close" },
      { ...base, version: "1", type: "close" },
      { ...base, type: "resize" },
      { ...base, type: "resize", height: 0 },
      { ...base, type: "resize", height: -5 },
      { ...base, type: "resize", height: 1.5 },
      { ...base, type: "resize", height: 999999 },
      { ...base, type: "resize", height: "300" },
      { ...base, type: "resize", height: Number.NaN },
      { ...base, type: "unread", count: -1 },
      { ...base, type: "unread", count: 1.2 },
      { ...base, type: "unread", count: Number.POSITIVE_INFINITY },
      { ...base, type: "unread" },
      { ...base, type: { toString: () => "close" } },
    ];
    for (const j of junk) expect(parseWidgetMessage(j)).toBeNull();
  });

  it("agrees with the zod schema", () => {
    const candidates: Record<string, unknown>[] = [
      { type: "ready" },
      { type: "close" },
      { type: "resize", height: 1 },
      { type: "resize", height: 5000 },
      { type: "resize", height: 5001 },
      { type: "resize", height: 0 },
      { type: "unread", count: 999 },
      { type: "unread", count: 1000 },
      { type: "unread", count: -1 },
      { type: "bogus" },
    ];
    for (const c of candidates) {
      expect(parseWidgetMessage({ ...base, ...c }) !== null).toBe(
        getWidgetMessageSchema().safeParse(c).success,
      );
    }
  });
});
