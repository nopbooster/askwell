import { NextResponse, type NextRequest } from "next/server";
import type { ApiError } from "@askwell/shared";

// TEMPORARY (P4C-T05): preview-only checks for PostHog setup. Removed in a separate commit before merge.
// ?diag=1 returns booleans only (never a value or any part of one). Otherwise it throws to test server error tracking.
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "preview") {
    const body: ApiError = { error: { code: "not_found", message: "Not found." } };
    return NextResponse.json(body, { status: 404 });
  }
  if (request.nextUrl.searchParams.get("diag") === "1") {
    // Read through an alias, like lib/posthog/config.ts, so Next.js doesn't inline build-time values.
    const env: Record<string, string | undefined> = process.env;
    const key = env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ?? "";
    const host = env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ?? "";
    return NextResponse.json(
      { keySet: key.length > 0, hostSet: host.length > 0, hostHasScheme: /^https?:\/\//.test(host) },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  throw new Error("P4C-T05 test server error (temporary)");
}
