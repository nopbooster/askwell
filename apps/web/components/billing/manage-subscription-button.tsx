"use client";

import { useClerk } from "@clerk/nextjs";
import { Button } from "../ui";

/** The Billing tab of Clerk's user profile (plan, cancel, payment methods, invoices). */
export const BILLING_PROFILE_PATH = "/billing";

/** Opens Clerk's account portal on its Billing tab, in a modal. Disabled until Clerk has loaded. */
export function ManageSubscriptionButton() {
  const clerk = useClerk();
  return (
    <Button
      variant="secondary"
      disabled={!clerk.loaded}
      onClick={() => clerk.openUserProfile({ __experimental_startPath: BILLING_PROFILE_PATH })}
    >
      Manage subscription
    </Button>
  );
}
