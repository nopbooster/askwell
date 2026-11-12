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

  it("agrees with the zod schema on complete messages", () => {
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
      { source: "other-widget", type: "close" },
      { version: 2, type: "close" },
    ];
    for (const c of candidates) {
      const full = { ...base, ...c };
      expect(parseWidgetMessage(full) !== null, JSON.stringify(full)).toBe(
        getWidgetMessageSchema().safeParse(full).success,
      );
    }
    // an incomplete message (no envelope) is rejected by both
    expect(getWidgetMessageSchema().safeParse({ type: "close" }).success).toBe(
      false,
    );
  });
});

describe("createWidgetMessage", () => {
  it("clamps numbers so the loader never drops the result", () => {
    for (const [input, expected] of [
      [{ type: "unread", count: 1000 }, 999],
      [{ type: "unread", count: -4 }, 0],
      [{ type: "unread", count: 2.6 }, 3],
    ] as const) {
      expect(parseWidgetMessage(createWidgetMessage(input))).toMatchObject({
        count: expected,
      });
    }
    for (const [h, expected] of [
      [0, 1],
      [99999, 5000],
      [Number.NaN, 1],
      [300.4, 300],
    ] as const) {
      expect(
        parseWidgetMessage(createWidgetMessage({ type: "resize", height: h })),
      ).toMatchObject({
        height: expected,
      });
    }
  });

  it("cannot have its envelope overridden by extra fields", () => {
    const extra = {
      type: "close" as const,
      source: "other-widget",
      version: 9,
    };
    expect(parseWidgetMessage(createWidgetMessage(extra))).not.toBeNull();
  });
});
