// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"handleDisabledFileLoadingAsSuccess":true}}
/**
 * postMessage audit (project.md §9 postMessage): the loader and the panel check `event.origin` on
 * every incoming message and never use "*" as the target origin for data. Read-only: these tests
 * lock the current behavior in. The panel's channel is also covered in apps/web/components/embed.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_WIDGET_CONFIG, WIDGET_MESSAGE_VERSION, widgetMessageSource } from "@askwell/shared";
import { createParentChannel } from "../../web/components/embed/parent-channel";
import { parseParentOrigin } from "../../web/components/embed/params";
import { init, type WidgetHandle } from "./widget";

const REPO = resolve(__dirname, "../../..");
const SCANNED = ["apps/widget/src", "apps/web/app", "apps/web/components", "apps/web/lib", "packages/shared/src"];

/** Every non-test .ts/.tsx source file under the scanned folders, relative to the repo root. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "node_modules" ? [] : sources(full);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [relative(REPO, full)] : [];
  });
}
const files = SCANNED.flatMap((d) => sources(join(REPO, d)));
const read = (f: string) => readFileSync(join(REPO, f), "utf8");

describe("inventory of postMessage calls and message listeners", () => {
  it("the only postMessage call is the panel's channel (audited; a new call must be audited and added here)", () => {
    const callers = files.filter((f) => /\.postMessage\s*\(/.test(read(f)));
    expect(callers).toEqual(["apps/web/components/embed/parent-channel.ts"]);
  });

  it('no source ever passes "*" as a postMessage target origin', () => {
    for (const f of files) expect(read(f), f).not.toMatch(/postMessage\s*\([^)]*,\s*["'`]\*["'`]/);
  });

  it("the panel posts with targetOrigin = the validated parent origin", () => {
    expect(read("apps/web/components/embed/parent-channel.ts")).toMatch(/\.postMessage\(\s*msg\s*,\s*parentOrigin\s*\)/);
  });

  it("the only message listeners are the loader's and the panel's, and both compare event.origin", () => {
    const listeners = files.filter((f) => /addEventListener\(\s*["']message["']/.test(read(f)) || /\bonmessage\s*=/.test(read(f)));
    expect(listeners.sort()).toEqual(["apps/web/components/embed/parent-channel.ts", "apps/widget/src/widget.ts"]);
    expect(read("apps/widget/src/widget.ts")).toMatch(/e\.origin !== base/);
    expect(read("apps/web/components/embed/parent-channel.ts")).toMatch(/event\.origin === parentOrigin/);
  });
});

// ---------- Loader (apps/widget) ----------

const KEY = "pk_abcdefghijklmnop1234";
const BASE = "https://app.example.com";
const msg = (m: Record<string, unknown>) => ({ source: widgetMessageSource(), version: WIDGET_MESSAGE_VERSION, ...m });

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  document.body.innerHTML = "";
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function openWidget(): Promise<WidgetHandle> {
  vi.stubGlobal("fetch", vi.fn(async () => ({ status: 200, ok: true, json: async () => DEFAULT_WIDGET_CONFIG })));
  const s = document.createElement("script");
  s.src = `${BASE}/widget.js`;
  s.setAttribute("data-key", KEY);
  const h = await init(s);
  if (!h) throw new Error("widget did not start");
  (h.root.querySelector("button") as HTMLButtonElement).click();
  return h;
}
const isOpen = (h: WidgetHandle) => (h.root.querySelector(".p") as HTMLElement).classList.contains("o");
const send = (h: WidgetHandle, origin: string, data: unknown, source: MessageEventSource | null = h.iframe()?.contentWindow ?? null) =>
  window.dispatchEvent(new MessageEvent("message", { origin, data, source }));

describe("loader: incoming messages need the exact app origin and the panel's window", () => {
  it("control: a close message from the panel at the app origin closes the panel", async () => {
    const h = await openWidget();
    send(h, BASE, msg({ type: "close" }));
    expect(isOpen(h)).toBe(false);
  });

  it.each([
    "https://app.example.com.evil.example", // lookalike suffix
    "https://evil.app.example.com", // subdomain
    "http://app.example.com", // other scheme
    "https://app.example.com:8443", // other port
    "https://APP.example.com:443/", // not the serialized origin
    "null", // sandboxed / opaque origin
    "", // no origin
    "*",
  ])("ignores a close message from origin %j", async (origin) => {
    const h = await openWidget();
    send(h, origin, msg({ type: "close" }));
    expect(isOpen(h)).toBe(true);
  });

  it("ignores the right origin from the wrong window (e.g. another iframe of the app)", async () => {
    const h = await openWidget();
    send(h, BASE, msg({ type: "close" }), window);
    expect(isOpen(h)).toBe(true);
  });

  it.each([null, "close", { type: "close" }, msg({ type: "close", version: 99 }), msg({ type: "resize", height: "9999" })])(
    "ignores a malformed message at the right origin: %j",
    async (data) => {
      const h = await openWidget();
      send(h, BASE, data);
      expect(isOpen(h)).toBe(true);
      expect((h.root.querySelector(".p") as HTMLElement).style.height).toBe("");
    },
  );

  it("never calls postMessage itself (it only listens)", async () => {
    const top = vi.spyOn(window, "postMessage");
    const h = await openWidget();
    const frameWin = h.iframe()?.contentWindow;
    const framePost = frameWin ? vi.spyOn(frameWin, "postMessage") : null;
    send(h, BASE, msg({ type: "resize", height: 300 }));
    send(h, BASE, msg({ type: "unread", count: 1 }));
    send(h, BASE, msg({ type: "close" }));
    (h.root.querySelector("button") as HTMLButtonElement).click();
    expect(top).not.toHaveBeenCalled();
    if (framePost) expect(framePost).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});

// ---------- Panel (apps/web/components/embed) ----------

describe("panel: the target origin can never become '*' or 'null'", () => {
  it.each(["*", "null", "https://example.com/", "https://example.com/path", "javascript:alert(1)", "file:///etc", "data:text/html,x", "", undefined])(
    "parseParentOrigin(%j) is rejected, so the channel never posts",
    (value) => {
      expect(parseParentOrigin(value)).toBeNull();
      const parent = { postMessage: vi.fn() };
      const win = { parent, addEventListener: vi.fn(), removeEventListener: vi.fn() };
      const channel = createParentChannel(win, parseParentOrigin(value));
      expect(channel.post({ type: "close" })).toBeNull();
      expect(parent.postMessage).not.toHaveBeenCalled();
    },
  );

  it('a "*" inside a host is not a wildcard: the value is used literally (no real window has that origin)', () => {
    // parseParentOrigin accepts it ("*" is a legal URL host character). postMessage treats only the
    // exact string "*" as "any origin"; anything else must equal the receiver's origin, so this posts nowhere.
    expect(parseParentOrigin("https://*.example.com")).toBe("https://*.example.com");
    const parent = { postMessage: vi.fn() };
    const channel = createParentChannel({ parent, addEventListener: vi.fn(), removeEventListener: vi.fn() }, parseParentOrigin("https://*.example.com"));
    channel.post({ type: "close" });
    expect(parent.postMessage).toHaveBeenCalledWith(expect.anything(), "https://*.example.com");
    expect(parent.postMessage.mock.calls[0]?.[1]).not.toBe("*");
  });

  it("every message type is posted only to the exact parent origin", () => {
    const parent = { postMessage: vi.fn() };
    const win = { parent, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const channel = createParentChannel(win, "https://customer.example");
    channel.post({ type: "ready" });
    channel.post({ type: "close" });
    channel.post({ type: "resize", height: 400 });
    channel.post({ type: "unread", count: 3 });
    expect(parent.postMessage.mock.calls.map(([, target]) => target)).toEqual(Array(4).fill("https://customer.example"));
  });
});
