import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isDashboardRoute, isOwnerApiRoute } from "./lib/auth/routes";

export default clerkMiddleware(
  async (auth, req) => {
    const { pathname } = req.nextUrl;

    if (isOwnerApiRoute(pathname)) {
      const { isAuthenticated } = await auth();
      if (!isAuthenticated) {
        return NextResponse.json(
          { error: { code: "unauthorized", message: "Sign in to use this API." } },
          { status: 401 },
        );
      }
      return;
    }

    if (isDashboardRoute(pathname)) {
      await auth.protect();
    }
  },
  { signInUrl: "/sign-in", signUpUrl: "/sign-up" },
);

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
