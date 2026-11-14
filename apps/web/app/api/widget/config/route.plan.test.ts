import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_WIDGET_CONFIG, WidgetConfigResponseSchema } from "@askwell/shared";

// The real getWidgetConfigByKey + applyPlan; only the database read is faked.
vi.mock("server-only", () => ({}));
vi.mock("../../../../lib/arcjet", () => ({ protectWidgetRequest: async () => ({ status: "allowed" }) }));

let row: { widget_configs: Record<string, unknown> | null; accounts: { plan: string } | null } | null = null;
vi.mock("../../../../lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }),
  }),
}));

import { GET } from "./route";

const KEY = "pk_abcdefghijklmnop";
const CUSTOM = {
  button_color: "#c2410c",
  position: "top-left",
  label: "Help",
  animation: "slide",
  header_text: "Hi from Pro",
  show_badge: false,
};
const get = async () => {
  const res = await GET(new Request(`http://localhost/api/widget/config?key=${KEY}`));
  expect(res.status).toBe(200);
  return WidgetConfigResponseSchema.parse(await res.json());
};

beforeEach(() => {
  row = null;
});

describe("GET /api/widget/config applies the plan", () => {
  it("Pro: every stored field reaches the widget, badge hidden when show_badge is false", async () => {
    row = { widget_configs: CUSTOM, accounts: { plan: "pro" } };
    expect(await get()).toEqual({
      buttonColor: "#c2410c",
      position: "top-left",
      label: "Help",
      animation: "slide",
      headerText: "Hi from Pro",
      showBadge: false,
    });
  });

  it("Pro with show_badge true keeps the badge", async () => {
    row = { widget_configs: { ...CUSTOM, show_badge: true }, accounts: { plan: "pro" } };
    expect((await get()).showBadge).toBe(true);
  });

  it("Free ignores stored custom values: defaults and the badge", async () => {
    row = { widget_configs: CUSTOM, accounts: { plan: "free" } };
    expect(await get()).toEqual(DEFAULT_WIDGET_CONFIG);
  });
});
