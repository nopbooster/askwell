"use client";

import { ErrorState } from "../../../components/ui";

export default function BillingError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState title="Couldn't load the billing page" onRetry={reset} />;
}
