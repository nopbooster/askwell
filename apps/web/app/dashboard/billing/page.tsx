import type { Metadata } from "next";
import { CurrentPlanCard, ManageSubscriptionButton, PricingSection } from "../../../components/billing";
import { ErrorState, PageHeader } from "../../../components/ui";
import { getOwnerPlan } from "../../../lib/accounts";

export const metadata: Metadata = { title: "Billing" };
// The plan changes when Clerk's webhook arrives: never serve a cached page.
export const dynamic = "force-dynamic";

export default async function Page() {
  // The plan shown is `accounts.plan`, read on the server (the webhook keeps it in sync with Clerk).
  const planState = await getOwnerPlan();

  return (
    <>
      <PageHeader title="Billing" description="Your plan and subscription." actions={<ManageSubscriptionButton />} />
      {planState.status === "ok" ? (
        <div className="space-y-8">
          <CurrentPlanCard plan={planState.plan} />
          <section aria-labelledby="plans-title" className="space-y-3">
            <div>
              <h2 id="plans-title" className="text-base font-medium">
                Plans
              </h2>
              <p className="mt-1 text-sm text-fg-muted">
                {planState.plan === "pro"
                  ? "You're on Pro. To cancel, use Manage subscription: Pro stays until the end of the paid period."
                  : "Upgrade to Pro for more projects, messages and sources, and a custom widget."}{" "}
                After checkout, your plan updates here within a few seconds.
              </p>
            </div>
            <PricingSection />
          </section>
        </div>
      ) : (
        <ErrorState title="Can't load your plan" description="Reload the page. If it keeps happening, contact support." />
      )}
    </>
  );
}
