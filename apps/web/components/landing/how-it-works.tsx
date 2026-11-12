import { GlassPanel } from "../ui";
import { Reveal } from "./reveal";

const STEPS = [
  { title: "Add your info", body: "Paste text or upload a PDF. That is what the bot learns from." },
  { title: "Copy one script tag", body: "Paste it into your site. The chat button appears." },
  { title: "Visitors get answers", body: "They ask, the bot replies from your content. You read every chat." },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-16">
      <Reveal>
        <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
      </Reveal>
      <ol className="mt-8 grid gap-4 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title}>
            <Reveal delayMs={i * 100} className="h-full">
              <GlassPanel className="h-full p-6">
                <span className="text-sm text-fg-muted">Step {i + 1}</span>
                <h3 className="mt-2 text-lg font-medium">{step.title}</h3>
                <p className="mt-1 text-sm text-fg-muted">{step.body}</p>
              </GlassPanel>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}
