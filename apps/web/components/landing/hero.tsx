import { Reveal } from "./reveal";
import { LinkButton } from "./link-button";

export function Hero() {
  return (
    <section className="mx-auto max-w-5xl px-4 pt-20 pb-16 text-center md:pt-32">
      <Reveal>
        <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-6xl">
          An AI support chat for any website, trained on your docs.
        </h1>
      </Reveal>
      <Reveal delayMs={120}>
        <p className="mx-auto mt-5 max-w-xl text-base text-fg-muted md:text-lg">
          Add your info, paste one script tag, and your visitors get answers at any hour.
        </p>
      </Reveal>
      <Reveal delayMs={240} className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <LinkButton href="/sign-up" className="min-h-11 px-6">
          Start free
        </LinkButton>
        <LinkButton href="#how-it-works" variant="secondary" className="min-h-11 px-6">
          See how it works
        </LinkButton>
      </Reveal>
    </section>
  );
}
