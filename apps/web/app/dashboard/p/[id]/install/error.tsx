"use client";

import { ErrorState } from "../../../../../components/ui";

export default function InstallError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState title="Couldn't load the install page" onRetry={reset} />;
}
