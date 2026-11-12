"use client";

import { ErrorState } from "../../../../../components/ui";

export default function KnowledgeError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState title="Couldn't load the knowledge page" onRetry={reset} />;
}
