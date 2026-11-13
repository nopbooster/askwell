"use client";

import { ErrorState } from "../../../../../components/ui";

export default function ConversationsError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState title="Couldn't load the conversations page" onRetry={reset} />;
}
