import { NextResponse } from "next/server";
import {
  PosthogConfigResponseSchema,
  type ApiError,
  type PosthogConfigResponse,
} from "@askwell/shared";
import { readPosthogConfig } from "../../../lib/posthog/config";

// Read at request time: never prerender or cache, so a changed variable takes effect on the next request.
export const dynamic = "force-dynamic";

/** GET /api/posthog-config: PostHog's public project key and host (project.md §8). */
export function GET() {
  const config = readPosthogConfig();
  if (!config) {
    const body: ApiError = {
      error: { code: "internal", message: "Analytics is not configured." },
    };
    return NextResponse.json(body, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const body: PosthogConfigResponse = PosthogConfigResponseSchema.parse(config);
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
