// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_NAME, DEFAULT_WIDGET_CONFIG, type WidgetConfig } from "@askwell/shared";
import { CustomizeForm } from "./customize-form";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PID = "11111111-1111-4111-8111-111111111111";
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const render = (plan: "free" | "pro", initialConfig: WidgetConfig = DEFAULT_WIDGET_CONFIG) =>
  act(() => root.render(<CustomizeForm projectId={PID} plan={plan} initialConfig={initialConfig} />));
const q = <T extends Element>(sel: string) => container.querySelector(sel) as T;
const byLabel = <T extends HTMLElement>(text: string) => {
  const label = [...container.querySelectorAll("label")].find((l) => l.textContent?.trim().startsWith(text));
  return document.getElementById(label?.htmlFor ?? "") as T;
};
const button = (text: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(text)) as HTMLButtonElement | undefined;
const preview = (id: string) => q<HTMLElement>(`[data-testid="${id}"]`);

/** Sets a value the way a user would, so React's onChange fires. */
function type(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}
const badgeBox = () => q<HTMLInputElement>('input[type="checkbox"]');
async function save() {
  await act(async () => {
    q<HTMLFormElement>("form").requestSubmit();
  });
}

describe("CustomizeForm: Free (locked)", () => {
  it("shows the form locked, with an upgrade prompt linking to Billing", () => {
    render("free");
    expect(preview("locked-notice").textContent).toContain("Pro feature");
    expect(q<HTMLAnchorElement>('[data-testid="locked-notice"] a').getAttribute("href")).toBe("/dashboard/billing");
    expect(q<HTMLFieldSetElement>('[data-testid="customize-fields"]').disabled).toBe(true);
    expect(byLabel<HTMLInputElement>("Button label").value).toBe(DEFAULT_WIDGET_CONFIG.label);
    expect(button("Save")?.disabled).toBe(true);
  });

  it("never calls the API from a locked form", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render("free");
    await save();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("previews the Free look: default button and the badge", () => {
    render("free");
    expect(preview("preview-button").textContent).toBe("Ask us");
    expect(preview("preview-badge").textContent).toBe(`Powered by ${APP_NAME}`);
  });
});

describe("CustomizeForm: Pro (unlocked)", () => {
  it("is editable, with no upgrade prompt", () => {
    render("pro");
    expect(preview("locked-notice")).toBeNull();
    expect(q<HTMLFieldSetElement>('[data-testid="customize-fields"]').disabled).toBe(false);
    expect(button("Save")?.disabled).toBe(true); // nothing changed yet
  });

  it("updates the preview live from unsaved values", () => {
    render("pro");
    type(byLabel("Button label"), "Talk to us");
    type(byLabel("Button color"), "#0e7490");
    type(byLabel("Panel header"), "Hi there");
    type(byLabel("Button position"), "top-left");
    act(() => badgeBox().click());

    expect(preview("preview-button").textContent).toBe("Talk to us");
    expect(preview("preview-button").style.background).toContain("#0e7490");
    expect(preview("preview-button").className).toMatch(/top-3/);
    expect(preview("preview-button").className).toMatch(/left-4/);
    expect(preview("preview-header").textContent).toBe("Hi there");
    expect(preview("preview-badge")).toBeNull();

    type(byLabel("Open animation"), "scale");
    expect(preview("preview-panel").dataset.animation).toBe("scale");
    expect(preview("preview-panel").className).toContain("starting:scale-90");
  });

  it("renders label and header as text, never HTML", () => {
    render("pro");
    type(byLabel("Button label"), "<img src=x onerror=alert(1)>");
    type(byLabel("Panel header"), "<b>bold</b>");
    expect(container.querySelector('[data-testid="widget-preview"] img')).toBeNull();
    expect(container.querySelector('[data-testid="widget-preview"] b')).toBeNull();
    expect(preview("preview-button").textContent).toBe("<img src=x onerror=alert(1)>");
  });

  it("Save sends a PATCH and shows success", async () => {
    const saved = { ...DEFAULT_WIDGET_CONFIG, label: "Talk to us" };
    const fetch = vi.fn(async () => Response.json({ config: saved }));
    vi.stubGlobal("fetch", fetch);
    render("pro");
    type(byLabel("Button label"), "  Talk to us ");
    await save();

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`/api/projects/${PID}/config`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual(saved); // trimmed; no plan field
    expect(container.textContent).toContain("Saved.");
    expect(button("Save")?.disabled).toBe(true); // clean again
  });

  it("402 from the server: locks the form and shows the server's message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: { code: "payment_required", message: "Upgrade to Pro to save changes." } }, { status: 402 })),
    );
    render("pro");
    type(byLabel("Button label"), "Help");
    await save();
    expect(preview("locked-notice").textContent).toContain("Upgrade to Pro to save changes.");
    expect(q<HTMLFieldSetElement>('[data-testid="customize-fields"]').disabled).toBe(true);
    expect(container.textContent).not.toContain("Saved.");
  });

  it("other errors: shows a clear message and keeps the edits", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: { code: "internal", message: "Something went wrong." } }, { status: 500 })),
    );
    render("pro");
    type(byLabel("Button label"), "Help");
    await save();
    expect(q('[role="alert"]').textContent).toBe("Something went wrong.");
    expect(byLabel<HTMLInputElement>("Button label").value).toBe("Help");
    expect(q<HTMLFieldSetElement>('[data-testid="customize-fields"]').disabled).toBe(false);
  });

  it("a network failure shows a message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    render("pro");
    type(byLabel("Button label"), "Help");
    await save();
    expect(q('[role="alert"]').textContent).toContain("Could not reach the server");
  });

  it("invalid values show a hint and disable Save", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render("pro");
    type(byLabel("Button color"), "green");
    type(byLabel("Button label"), "   ");
    expect(container.textContent).toContain("Use a hex color");
    expect(container.textContent).toContain("1 to 40 characters.");
    expect(button("Save")?.disabled).toBe(true);
    await save();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("Undo changes restores the saved values", () => {
    render("pro");
    type(byLabel("Button label"), "Help");
    act(() => button("Undo changes")?.click());
    expect(byLabel<HTMLInputElement>("Button label").value).toBe("Ask us");
    expect(preview("preview-button").textContent).toBe("Ask us");
  });
});
