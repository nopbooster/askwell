import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";

/**
 * Clerk is mounted per section, not in the root layout, so /embed (a cross-site iframe)
 * never loads Clerk. Wrap dashboard, sign-in, sign-up and the landing page with this.
 */
export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      afterSignOutUrl="/sign-in"
    >
      {children}
    </ClerkProvider>
  );
}
