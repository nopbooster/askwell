"use client";

import { ErrorState } from "../../../../../components/ui";

export default function CustomizeError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState title="Couldn't load the customize page" onRetry={reset} />;
}
