import Script from "next/script";
import { connection } from "next/server";
import { PUBLIC_KEY_REGEX } from "@askwell/shared";
import { getAppUrl } from "../../lib/app-url";
import { GlassPanel } from "../ui";
import { Reveal } from "./reveal";

const TRY_ASKING = ["Is there a free plan?", "How do I add the widget to my site?", "What can I upload as knowledge?"];

/**
 * The landing page's own widget (project.md §6.1, §2 steps 1–2): the app's project about itself,
 * loaded exactly the way customers load it.
 *
 * `LANDING_WIDGET_KEY` is read per request (never `NEXT_PUBLIC_*`, never baked at build), so each
 * environment uses its own project. With no key, a malformed one, or no usable app URL, the
 * static mock shows instead, and nothing throws.
 */
export async function landingWidget(): Promise<{ src: string; publicKey: string } | null> {
  await connection(); // render per request: the key comes from this request's environment
  const publicKey = process.env.LANDING_WIDGET_KEY?.trim() ?? "";
  if (!PUBLIC_KEY_REGEX.test(publicKey)) return null;
  try {
    return { src: `${await getAppUrl()}/widget.js`, publicKey };
  } catch {
    return null;
  }
}

export async function Demo() {
  const widget = await landingWidget();

  return (
    <section className="mx-auto max-w-5xl px-4 py-16">
      <Reveal>
        <h2 className="text-3xl font-semibold tracking-tight">See it in action</h2>
        <p className="mt-2 text-fg-muted">
          {widget
            ? "The chat button in the corner is the real widget, answering from what it knows about us. Go ahead, ask it something."
            : "This is what your visitors see."}
        </p>
      </Reveal>
      {widget ? (
        <>
          <Reveal delayMs={100} className="mt-8">
            <GlassPanel className="max-w-xl p-5" data-testid="live-demo">
              <p className="text-sm font-medium">Try asking</p>
              <ul className="mt-3 flex flex-wrap gap-2 text-sm text-fg-muted">
                {TRY_ASKING.map((q) => (
                  <li key={q} className="rounded-control border border-line px-3 py-1.5">
                    {q}
                  </li>
                ))}
              </ul>
            </GlassPanel>
          </Reveal>
          {/* The same one-line install customers paste: the loader reads data-key from its own tag. */}
          <Script id="askwell-landing-widget" src={widget.src} data-key={widget.publicKey} strategy="afterInteractive" />
        </>
      ) : (
        <Reveal delayMs={100} className="mt-8 flex justify-center md:justify-end">
          <GlassPanel className="w-full max-w-sm overflow-hidden" aria-label="Example chat (not interactive)">
            <div className="border-b border-line bg-surface-strong px-4 py-3 text-sm font-medium">Support</div>
            <div className="space-y-3 p-4 text-sm">
              <p className="ml-auto w-fit max-w-[85%] rounded-panel rounded-br-sm bg-accent px-3 py-2 text-accent-fg">
                Do you offer a free plan?
              </p>
              <p className="w-fit max-w-[85%] rounded-panel rounded-bl-sm bg-surface-strong px-3 py-2">
                Yes. The Free plan costs nothing and has no time limit.
              </p>
            </div>
            <div className="border-t border-line px-4 py-3 text-sm text-fg-muted">Ask a question…</div>
          </GlassPanel>
        </Reveal>
      )}
    </section>
  );
}
