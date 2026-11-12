// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"handleDisabledFileLoadingAsSuccess":true}}
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_WIDGET_CONFIG,
  WIDGET_MESSAGE_VERSION,
  widgetMessageSource,
} from "@askwell/shared";
import { init, type WidgetHandle } from "./widget";

const KEY = "pk_abcdefghijklmnop1234";
const BASE = "https://app.example.com";
const config = {
  ...DEFAULT_WIDGET_CONFIG,
  buttonColor: "#336699",
  position: "top-left" as const,
  label: "Help me",
};

function scriptTag(
  attrs: { key?: string | null; src?: string } = {},
): HTMLScriptElement {
  const s = document.createElement("script");
  s.src = attrs.src ?? `${BASE}/widget.js`;
  if (attrs.key !== null) s.setAttribute("data-key", attrs.key ?? KEY);
  return s;
}

function mockFetch(impl: () => Promise<unknown>) {
  const f = vi.fn(impl);
  vi.stubGlobal("fetch", f);
  return f;
}
const ok = (body: unknown, status = 200) =>
  Promise.resolve({ status, ok: status === 200, json: async () => body });

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  document.body.innerHTML = "";
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function mustInit(): Promise<WidgetHandle> {
  const h = await init(scriptTag());
  if (!h) throw new Error("widget did not start");
  return h;
}
async function start(): Promise<WidgetHandle> {
  mockFetch(() => ok(config));
  const h = await init(scriptTag());
  if (!h) throw new Error("widget did not start");
  return h;
}
const button = (h: WidgetHandle) =>
  h.root.querySelector("button") as HTMLButtonElement;
const panel = (h: WidgetHandle) => h.root.querySelector(".p") as HTMLElement;
const dot = (h: WidgetHandle) => h.root.querySelector("i") as HTMLElement;

function post(h: WidgetHandle, data: unknown, origin = BASE, fromFrame = true) {
  window.dispatchEvent(
    new MessageEvent("message", {
      data,
      origin,
      source: fromFrame ? (h.iframe()?.contentWindow ?? null) : window,
    }),
  );
}
const msg = (m: Record<string, unknown>) => ({
  source: widgetMessageSource(),
  version: WIDGET_MESSAGE_VERSION,
  ...m,
});

describe("start-up", () => {
  it.each([null, "", "nope", "sk_abcdefghijklmnop1234", "pk_short"])(
    "renders nothing for key %j",
    async (key) => {
      const f = mockFetch(() => ok(config));
      expect(await init(scriptTag({ key }))).toBeNull();
      expect(f).not.toHaveBeenCalled();
      expect(document.body.children).toHaveLength(0);
    },
  );

  it("renders nothing without a script tag", async () => {
    expect(await init(null)).toBeNull();
    expect(document.body.children).toHaveLength(0);
  });

  it("fetches the config from the script's origin", async () => {
    const f = mockFetch(() => ok(config));
    await init(scriptTag({ src: `${BASE}/some/path/widget.js?v=2` }));
    expect(f).toHaveBeenCalledWith(`${BASE}/api/widget/config?key=${KEY}`);
  });

  it("renders nothing, with one warning, when fetch fails", async () => {
    mockFetch(() => Promise.reject(new Error("network")));
    expect(await init(scriptTag())).toBeNull();
    expect(document.body.children).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it.each([404, 500])("renders nothing on HTTP %i", async (status) => {
    mockFetch(() => ok({ error: { code: "not_found", message: "x" } }, status));
    expect(await init(scriptTag())).toBeNull();
    expect(document.body.children).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["not an object", "nope"],
    ["null", null],
    ["bad color", { ...config, buttonColor: "red" }],
    ["bad position", { ...config, position: "middle" }],
    ["bad animation", { ...config, animation: "spin" }],
    ["empty label", { ...config, label: "  " }],
    ["missing showBadge", { ...config, showBadge: undefined }],
  ])("renders nothing for an invalid body (%s)", async (_n, body) => {
    mockFetch(() => ok(body));
    expect(await init(scriptTag())).toBeNull();
    expect(document.body.children).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when the body is not JSON", async () => {
    mockFetch(() =>
      Promise.resolve({
        status: 200,
        ok: true,
        json: async () => Promise.reject(new SyntaxError("x")),
      }),
    );
    expect(await init(scriptTag())).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("button text color", () => {
  it.each([
    ["#ff00ff", "#0a0a0a"],
    ["#ffffff", "#0a0a0a"],
    ["#0a0a0a", "#fff"],
    ["#336699", "#fff"],
  ])("%s gets the higher-contrast text color", async (color, text) => {
    mockFetch(() => ok({ ...config, buttonColor: color }));
    const h = await mustInit();
    expect(button(h).style.color).toBe(text);
  });
});

describe("mounting", () => {
  it("waits for <body> when the script runs from <head>", async () => {
    const body = document.body;
    const getter = vi
      .spyOn(document, "body", "get")
      .mockReturnValue(null as unknown as HTMLElement);
    mockFetch(() => ok(config));
    const h = await init(scriptTag());
    if (!h) throw new Error("widget did not start");
    expect(body.contains(h.host)).toBe(false); // nothing mounted yet, and no crash
    getter.mockRestore();
    document.dispatchEvent(new Event("DOMContentLoaded"));
    expect(document.body.contains(h.host)).toBe(true);
    expect(document.body.querySelectorAll("div")).toHaveLength(1);
  });

  it("mounts straight away when <body> exists", async () => {
    const h = await start();
    expect(document.body.contains(h.host)).toBe(true);
  });
});

describe("button", () => {
  it("adds exactly one host element and keeps everything in the shadow root", async () => {
    const h = await start();
    expect(document.body.children).toHaveLength(1);
    expect(document.body.firstElementChild).toBe(h.host);
    expect(h.host.shadowRoot).toBeNull(); // closed: the page cannot reach inside
    expect(document.head.querySelector("style")).toBeNull();
    expect(h.host.children).toHaveLength(0);
  });

  it("uses the configured color, corner and label", async () => {
    const h = await start();
    expect(button(h).textContent).toBe("Help me");
    expect(button(h).style.background).toContain("#336699");
    expect(button(h).style.top).toBe("20px");
    expect(button(h).style.left).toBe("20px");
    expect(button(h).style.bottom).toBe("");
  });

  it("puts the panel above the button in a bottom corner", async () => {
    mockFetch(() => ok({ ...config, position: "bottom-right" }));
    const h = await mustInit();
    expect(button(h).style.bottom).toBe("20px");
    expect(button(h).style.right).toBe("20px");
    expect(panel(h).style.bottom).toBe("80px");
  });

  it("sets no globals", async () => {
    const before = Object.keys(window);
    await start();
    expect(Object.keys(window).sort()).toEqual(before.sort());
  });

  it("renders the label as text, never HTML", async () => {
    mockFetch(() => ok({ ...config, label: "<img src=x onerror=alert(1)>" }));
    const h = await mustInit();
    expect(h.root.querySelector("img")).toBeNull();
    expect(button(h).textContent).toBe("<img src=x onerror=alert(1)>");
  });
});

describe("panel", () => {
  it("creates the iframe once, on first click, with the right URL", async () => {
    const h = await start();
    expect(h.iframe()).toBeNull();
    button(h).click();
    const frame = h.iframe();
    if (!frame) throw new Error("no iframe");
    expect(frame.getAttribute("src")).toBe(
      `${BASE}/embed?key=${KEY}&origin=${encodeURIComponent(location.origin)}`,
    );
    expect(panel(h).classList.contains("o")).toBe(true);
    button(h).click(); // close
    button(h).click(); // open again
    expect(h.root.querySelectorAll("iframe")).toHaveLength(1);
    expect(h.iframe()).toBe(frame);
  });

  it("uses the configured animation class", async () => {
    mockFetch(() => ok({ ...config, animation: "slide" }));
    const h = await mustInit();
    expect(panel(h).classList.contains("slide")).toBe(true);
  });

  it("closes on Escape", async () => {
    const h = await start();
    button(h).click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(panel(h).classList.contains("o")).toBe(false);
    expect(button(h).getAttribute("aria-expanded")).toBe("false");
  });
});

describe("messages", () => {
  it("close hides the panel", async () => {
    const h = await start();
    button(h).click();
    post(h, msg({ type: "close" }));
    expect(panel(h).classList.contains("o")).toBe(false);
  });

  it("resize sets the panel height", async () => {
    const h = await start();
    button(h).click();
    post(h, msg({ type: "resize", height: 420 }));
    expect(panel(h).style.height).toBe("420px");
  });

  it("unread shows the dot while closed, and opening clears it", async () => {
    const h = await start();
    button(h).click();
    post(h, msg({ type: "unread", count: 2 }));
    expect(dot(h).classList.contains("on")).toBe(false); // panel is open
    button(h).click(); // close
    post(h, msg({ type: "unread", count: 2 }));
    expect(dot(h).classList.contains("on")).toBe(true);
    button(h).click(); // open
    expect(dot(h).classList.contains("on")).toBe(false);
  });

  it("ignores a message from the wrong origin", async () => {
    const h = await start();
    button(h).click();
    post(h, msg({ type: "close" }), "https://evil.example.com");
    expect(panel(h).classList.contains("o")).toBe(true);
  });

  it("ignores a message from another window (wrong source)", async () => {
    const h = await start();
    button(h).click();
    post(h, msg({ type: "close" }), BASE, false);
    expect(panel(h).classList.contains("o")).toBe(true);
  });

  it("ignores messages before the iframe exists", async () => {
    const h = await start();
    post(h, msg({ type: "unread", count: 1 }));
    expect(dot(h).classList.contains("on")).toBe(false);
  });

  it.each([
    [
      "wrong source tag",
      {
        source: "other-widget",
        version: WIDGET_MESSAGE_VERSION,
        type: "close",
      },
    ],
    ["wrong version", { ...msg({ type: "close" }), version: 99 }],
    ["junk", "close"],
    ["bad resize", msg({ type: "resize", height: -1 })],
  ])("ignores a malformed message (%s)", async (_n, data) => {
    const h = await start();
    button(h).click();
    const before = panel(h).style.height;
    post(h, data);
    expect(panel(h).classList.contains("o")).toBe(true);
    expect(panel(h).style.height).toBe(before);
  });
});
