"use client";

import { ErrorState } from "../../../../../components/ui";

export default function UsageError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState title="Couldn't load the usage page" onRetry={reset} />;
}
