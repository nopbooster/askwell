"use client";

import { PricingTable } from "@clerk/nextjs";
import { Component, type ReactNode } from "react";
import { ErrorState, LoadingState } from "../ui";

/**
 * Keeps a Clerk pricing table failure (e.g. Billing not enabled yet) inside this section,
 * so the current plan above still shows.
 */
class PricingErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <ErrorState
          title="Plans can't be shown right now"
          description="Reload the page. If it keeps happening, contact support."
          onRetry={() => this.setState({ failed: false })}
        />
      );
    }
    return this.props.children;
  }
}

/** Clerk's pricing table: picking Pro opens Clerk's checkout drawer (Clerk payment gateway). */
export function PricingSection() {
  return (
    <PricingErrorBoundary>
      <PricingTable for="user" newSubscriptionRedirectUrl="/dashboard/billing" fallback={<LoadingState rows={4} />} />
    </PricingErrorBoundary>
  );
}
