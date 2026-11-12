"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import type { ReactNode } from "react";
import { useTheme } from "../theme/use-theme";

/**
 * Clerk is mounted per section, not in the root layout, so /embed (a cross-site iframe)
 * never loads Clerk. Wrap dashboard, sign-in, sign-up and the landing page with this.
 * Clerk's own dark theme follows the effective theme. The landing page is always dark.
 */
export function AuthProvider({
  children,
  alwaysDark = false,
}: Readonly<{ children: ReactNode; alwaysDark?: boolean }>) {
  const theme = useTheme();
  return (
    <ClerkProvider
      appearance={{ theme: alwaysDark || theme === "dark" ? dark : undefined }}
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
