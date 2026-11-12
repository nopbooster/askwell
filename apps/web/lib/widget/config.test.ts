import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_WIDGET_CONFIG } from "@askwell/shared";

vi.mock("server-only", () => ({}));

const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
vi.mock("../supabase/service", () => ({ createServiceClient: () => ({ from }) }));

import { getWidgetConfigByKey, mapWidgetConfigRow } from "./config";

const KEY = "pk_abcdefghijklmnop";
const row = {
  button_color: "#ff0000",
  position: "bottom-left",
  label: "Help",
  animation: "slide",
  header_text: "Hi there",
  show_badge: false,
};
const stored = {
  buttonColor: "#ff0000",
  position: "bottom-left",
  label: "Help",
  animation: "slide",
  headerText: "Hi there",
  showBadge: false,
};

beforeEach(() => {
  maybeSingle.mockReset();
  eq.mockClear();
  from.mockClear();
});

describe("mapWidgetConfigRow", () => {
  it("maps snake_case columns to the shared camelCase fields", () => {
    expect(mapWidgetConfigRow(row)).toEqual(stored);
  });
});

describe("getWidgetConfigByKey", () => {
  it("Pro keeps the stored values", async () => {
    maybeSingle.mockResolvedValue({ data: { widget_configs: row, accounts: { plan: "pro" } }, error: null });
    await expect(getWidgetConfigByKey(KEY)).resolves.toEqual(stored);
    expect(from).toHaveBeenCalledWith("projects");
    expect(eq).toHaveBeenCalledWith("public_key", KEY);
  });

  it("Free forces defaults and the badge, whatever is stored", async () => {
    maybeSingle.mockResolvedValue({ data: { widget_configs: row, accounts: { plan: "free" } }, error: null });
    await expect(getWidgetConfigByKey(KEY)).resolves.toEqual(DEFAULT_WIDGET_CONFIG);
  });

  it("treats a missing account or unknown plan as Free", async () => {
    maybeSingle.mockResolvedValue({ data: { widget_configs: row, accounts: null }, error: null });
    await expect(getWidgetConfigByKey(KEY)).resolves.toEqual(DEFAULT_WIDGET_CONFIG);
  });

  it("falls back to defaults when the config row is missing", async () => {
    maybeSingle.mockResolvedValue({ data: { widget_configs: null, accounts: { plan: "pro" } }, error: null });
    await expect(getWidgetConfigByKey(KEY)).resolves.toEqual(DEFAULT_WIDGET_CONFIG);
  });

  it("returns null for an unknown key", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(getWidgetConfigByKey(KEY)).resolves.toBeNull();
  });

  it("throws when the read fails", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(getWidgetConfigByKey(KEY)).rejects.toThrow("boom");
  });
});
