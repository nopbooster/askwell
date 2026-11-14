import type { Plan } from "@askwell/shared";
import { getPricingPlans } from "../landing/pricing";
import { GlassPanel } from "../ui";

/** The owner's current plan, as the server read it from `accounts.plan`. Never from the client. */
export function CurrentPlanCard({ plan }: { plan: Plan }) {
  const info = getPricingPlans().find((p) => p.plan === plan);
  if (!info) return null;
  return (
    <GlassPanel className="p-5 sm:p-6" aria-labelledby="current-plan-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="current-plan-title" className="text-sm font-medium text-fg-muted">
          Current plan
        </h2>
        <p className="text-sm text-fg-muted">
          {info.price} {info.priceNote}
        </p>
      </div>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{info.name}</p>
      <ul className="mt-4 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {info.features.map((feature) => (
          <li key={feature} className="flex gap-2">
            <span aria-hidden className="text-fg-muted">
              ✓
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}
