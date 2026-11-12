import {
  MAX_WIDGET_LABEL_CHARS,
  PUBLIC_KEY_REGEX,
  WIDGET_ANIMATIONS,
  WIDGET_POSITIONS,
  parseWidgetMessage,
  type WidgetConfig,
} from "@askwell/shared";

/** What `init` hands back (tests use it; the page never sees it). */
export type WidgetHandle = {
  host: HTMLElement;
  root: ShadowRoot;
  /** The iframe, or null until the first click. */
  iframe: () => HTMLIFrameElement | null;
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const warn = () => console.warn("[widget] could not start");

function parseConfig(data: unknown): WidgetConfig | null {
  if (typeof data !== "object" || data === null) return null;
  const c = data as Record<string, unknown>;
  if (
    typeof c.buttonColor !== "string" ||
    !HEX.test(c.buttonColor) ||
    !(WIDGET_POSITIONS as readonly unknown[]).includes(c.position) ||
    !(WIDGET_ANIMATIONS as readonly unknown[]).includes(c.animation) ||
    typeof c.label !== "string" ||
    !c.label.trim() ||
    c.label.length > MAX_WIDGET_LABEL_CHARS ||
    typeof c.headerText !== "string" ||
    typeof c.showBadge !== "boolean"
  ) {
    return null;
  }
  return c as WidgetConfig;
}

/** Black or white text, whichever reads better on the button color. */
function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? "#0a0a0a" : "#fff";
}

const CSS = `
*{box-sizing:border-box}
button{position:fixed;display:flex;align-items:center;gap:8px;height:48px;padding:0 20px;border:0;border-radius:24px;font:600 14px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.25)}
button:focus-visible{outline:3px solid #6d9eff;outline-offset:2px}
i{display:none;width:10px;height:10px;border-radius:50%;background:#e5484d;border:2px solid #fff}
i.on{display:block}
.p{position:fixed;width:380px;height:600px;max-width:calc(100vw - 24px);max-height:calc(100vh - 100px);border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 8px 32px rgba(0,0,0,.3);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .2s,transform .2s,visibility .2s}
.p.o{opacity:1;visibility:visible;pointer-events:auto;transform:none}
.slide{transform:translateY(24px)}
.scale{transform:scale(.9)}
iframe{width:100%;height:100%;border:0;display:block}
@media(max-width:479px){.p{inset:0!important;width:100%!important;height:100%!important;max-width:none;max-height:none;border-radius:0}}
@media(prefers-reduced-motion:reduce){.p{transition:none}}
`;

/**
 * Starts the loader for one script tag. Resolves to null (and renders nothing) on a bad key,
 * a failed fetch, or a bad config; at most one console.warn.
 */
export async function init(
  script: HTMLScriptElement | null,
): Promise<WidgetHandle | null> {
  if (!script) return null;
  const key = script.getAttribute("data-key") ?? "";
  if (!PUBLIC_KEY_REGEX.test(key)) return null;

  let base: string;
  let config: WidgetConfig | null;
  try {
    base = new URL(script.src).origin;
    const res = await fetch(
      `${base}/api/widget/config?key=${encodeURIComponent(key)}`,
    );
    config = res.status === 200 ? parseConfig(await res.json()) : null;
  } catch {
    config = null;
    base = "";
  }
  if (!config || !base || base === "null") {
    warn();
    return null;
  }
  const { buttonColor, position, label, animation } = config;

  const host = document.createElement("div");
  host.style.cssText = "all:initial";
  const root = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = CSS;

  const [v, h] = position.split("-") as ["top" | "bottom", "left" | "right"];
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-expanded", "false");
  button.style.cssText = `${v}:20px;${h}:20px;background:${buttonColor};color:${textOn(buttonColor)}`;
  const text = document.createElement("span");
  text.textContent = label;
  const dot = document.createElement("i");
  button.append(text, dot);

  const panel = document.createElement("div");
  panel.className = `p ${animation === "fade" ? "" : animation}`;
  panel.style.cssText = `${v}:${20 + 48 + 12}px;${h}:20px`;
  root.append(style, button, panel);

  let frame: HTMLIFrameElement | null = null;
  const setOpen = (open: boolean) => {
    if (open && !frame) {
      frame = document.createElement("iframe");
      frame.title = label;
      frame.setAttribute(
        "sandbox",
        "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox",
      );
      frame.src = `${base}/embed?key=${encodeURIComponent(key)}&origin=${encodeURIComponent(location.origin)}`;
      panel.append(frame);
    }
    panel.classList.toggle("o", open);
    button.setAttribute("aria-expanded", String(open));
    if (open) dot.classList.remove("on");
    else if (panel.contains(root.activeElement)) button.focus();
  };
  const isOpen = () => panel.classList.contains("o");
  button.addEventListener("click", () => setOpen(!isOpen()));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) setOpen(false);
  });

  window.addEventListener("message", (e: MessageEvent) => {
    if (e.origin !== base || !frame || e.source !== frame.contentWindow) return;
    const m = parseWidgetMessage(e.data);
    if (!m) return;
    if (m.type === "close") setOpen(false);
    else if (m.type === "resize")
      panel.style.height = `${Math.min(m.height, window.innerHeight - 100)}px`;
    else if (m.type === "unread")
      dot.classList.toggle("on", m.count > 0 && !isOpen());
  });

  document.body.append(host);
  return { host, root, iframe: () => frame };
}
