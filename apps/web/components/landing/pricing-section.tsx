import { GlassPanel } from "../ui";
import { LinkButton } from "./link-button";
import { getPricingPlans } from "./pricing";
import { Reveal } from "./reveal";

export function PricingSection() {
  const plans = getPricingPlans();
  return (
    <section id="pricing" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-16">
      <Reveal>
        <h2 className="text-3xl font-semibold tracking-tight">Pricing</h2>
        <p className="mt-2 text-fg-muted">Start free. Upgrade when you need more.</p>
      </Reveal>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {plans.map((plan, i) => (
          <Reveal key={plan.plan} delayMs={i * 100} className="h-full">
            <GlassPanel className={`flex h-full flex-col p-6 ${plan.highlighted ? "border-fg" : ""}`}>
              <h3 className="text-lg font-medium">{plan.name}</h3>
              <p className="mt-2">
                <span className="text-4xl font-semibold">{plan.price}</span>{" "}
                <span className="text-sm text-fg-muted">{plan.priceNote}</span>
              </p>
              <ul className="mt-6 flex-1 space-y-2 text-sm text-fg-muted">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <LinkButton href="/sign-up" variant={plan.highlighted ? "primary" : "secondary"} className="mt-6">
                {plan.plan === "free" ? "Start free" : "Get Pro"}
              </LinkButton>
            </GlassPanel>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
