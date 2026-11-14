// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({ failing: true }));
vi.mock("@clerk/nextjs", () => ({
  PricingTable: () => {
    if (state.failing) throw new Error("cannot_render_billing_disabled");
    return <div>pricing table</div>;
  },
}));

import { PricingSection } from "./pricing-section";

afterEach(() => vi.restoreAllMocks());

describe("PricingSection error boundary", () => {
  it("shows an error state instead of crashing the page, and Retry renders the table again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {}); // React logs the caught error
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    act(() => root.render(<PricingSection />));
    expect(container.textContent).toContain("Plans can't be shown right now");

    state.failing = false;
    const retry = [...container.querySelectorAll("button")].find((b) => b.textContent === "Retry");
    await act(async () => retry?.click());
    expect(container.textContent).toContain("pricing table");
    act(() => root.unmount());
    container.remove();
  });
});
