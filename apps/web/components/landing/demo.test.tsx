import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Script from "next/script";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
const getAppUrl = vi.fn(async () => "https://app.example.com");
vi.mock("../../lib/app-url", () => ({ getAppUrl: () => getAppUrl() }));

import { connection } from "next/server";
import { Demo, landingWidget } from "./demo";

const KEY = "pk_abcdefghijklmnop1234";

/** Every element in a server-rendered tree (props.children followed recursively). */
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as ReactNode)];
}
const scripts = (tree: ReactNode) => elements(tree).filter((e) => e.type === Script);

beforeEach(() => {
  getAppUrl.mockReset().mockResolvedValue("https://app.example.com");
  vi.mocked(connection).mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("landing demo", () => {
  it("with a key: loads /widget.js from the app's own URL with data-key, after the page is interactive", async () => {
    vi.stubEnv("LANDING_WIDGET_KEY", KEY);
    const tree = await Demo();
    const [script, ...rest] = scripts(tree);
    expect(rest).toHaveLength(0);
    expect(script?.props).toMatchObject({
      src: "https://app.example.com/widget.js",
      "data-key": KEY,
      strategy: "afterInteractive",
    });
    const html = renderToStaticMarkup(tree);
    expect(html).toContain("See it in action");
    expect(html).toContain("is the real widget");
    expect(html).not.toContain("Example chat (not interactive)");
  });

  it("reads the key per request (opts into dynamic rendering) and trims it", async () => {
    vi.stubEnv("LANDING_WIDGET_KEY", `  ${KEY} \n`);
    expect(await landingWidget()).toEqual({ src: "https://app.example.com/widget.js", publicKey: KEY });
    expect(connection).toHaveBeenCalled();
  });

  it.each([
    ["unset", undefined],
    ["empty", ""],
    ["blank", "   "],
    ["malformed", "not-a-key"],
  ])("without a usable key (%s): shows the mock, no script", async (_label, value) => {
    if (value === undefined) vi.stubEnv("LANDING_WIDGET_KEY", undefined as unknown as string);
    else vi.stubEnv("LANDING_WIDGET_KEY", value);
    const tree = await Demo();
    expect(scripts(tree)).toHaveLength(0);
    const html = renderToStaticMarkup(tree);
    expect(html).toContain("Example chat (not interactive)");
    expect(html).toContain("See it in action");
  });

  it("only reads the server-side variable, never a NEXT_PUBLIC_ copy", async () => {
    vi.stubEnv("LANDING_WIDGET_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_LANDING_WIDGET_KEY", KEY);
    expect(await landingWidget()).toBeNull();
  });

  it("falls back to the mock (and doesn't throw) when the app URL can't be determined", async () => {
    vi.stubEnv("LANDING_WIDGET_KEY", KEY);
    getAppUrl.mockRejectedValue(new Error("no host"));
    const tree = await Demo();
    expect(scripts(tree)).toHaveLength(0);
    expect(renderToStaticMarkup(tree)).toContain("Example chat (not interactive)");
  });
});
