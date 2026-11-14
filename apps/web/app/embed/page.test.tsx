import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_WIDGET_CONFIG } from "@askwell/shared";

// The real getWidgetConfigByKey + applyPlan; only the database read is faked.
vi.mock("server-only", () => ({}));

let row: { widget_configs: Record<string, unknown> | null; accounts: { plan: string } | null } | null = null;
vi.mock("../../lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }),
  }),
}));

import EmbedPage from "./page";
import { Panel } from "../../components/embed/panel";

const KEY = "pk_abcdefghijklmnop";
const CUSTOM = {
  button_color: "#c2410c",
  position: "top-left",
  label: "Help",
  animation: "slide",
  header_text: "Hi from Pro",
  show_badge: false,
};
const panelConfig = async () => {
  const el = (await EmbedPage({ searchParams: Promise.resolve({ key: KEY, origin: "https://shop.example" }) })) as {
    type: unknown;
    props: { config: { headerText: string; showBadge: boolean } };
  };
  expect(el.type).toBe(Panel);
  return el.props.config;
};

beforeEach(() => {
  row = null;
});

describe("/embed panel config", () => {
  it("Pro: the panel gets the stored header text and no badge", async () => {
    row = { widget_configs: CUSTOM, accounts: { plan: "pro" } };
    expect(await panelConfig()).toMatchObject({ headerText: "Hi from Pro", showBadge: false });
  });

  it("Free: the panel gets the default header and the badge, whatever is stored", async () => {
    row = { widget_configs: CUSTOM, accounts: { plan: "free" } };
    expect(await panelConfig()).toMatchObject({
      headerText: DEFAULT_WIDGET_CONFIG.headerText,
      showBadge: true,
    });
  });
});
