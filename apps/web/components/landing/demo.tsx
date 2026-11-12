import { GlassPanel } from "../ui";
import { Reveal } from "./reveal";

/**
 * Static mock of the chat panel. Not interactive.
 * PHASE 6: mount the real widget here (the app's own project) and remove this mock.
 */
export function Demo() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16">
      <Reveal>
        <h2 className="text-3xl font-semibold tracking-tight">See it in action</h2>
        <p className="mt-2 text-fg-muted">This is what your visitors see.</p>
      </Reveal>
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
    </section>
  );
}
