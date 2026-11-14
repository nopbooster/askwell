import { NextResponse } from "next/server";
import type { ApiError } from "@askwell/shared";

// TEMPORARY (P4C-T05): throws once on Vercel previews to confirm server error tracking.
// Removed in a separate commit before merge.
export const dynamic = "force-dynamic";

export function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    const body: ApiError = { error: { code: "not_found", message: "Not found." } };
    return NextResponse.json(body, { status: 404 });
  }
  throw new Error("P4C-T05 test server error (temporary)");
}
