import { GlassPanel } from "../ui";
import { Reveal } from "./reveal";

const SNIPPET = `<script src="https://your-app.example/widget.js" data-key="pk_your_project_key"></script>`;

export function InstallSnippet() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16">
      <Reveal>
        <h2 className="text-3xl font-semibold tracking-tight">One line to install</h2>
        <p className="mt-2 text-fg-muted">Paste this before the closing body tag of your site.</p>
      </Reveal>
      <Reveal delayMs={100} className="mt-8">
        <GlassPanel className="overflow-x-auto p-4">
          <pre className="font-mono text-sm">
            <code>{SNIPPET}</code>
          </pre>
        </GlassPanel>
      </Reveal>
    </section>
  );
}
