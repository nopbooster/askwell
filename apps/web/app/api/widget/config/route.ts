import { NextResponse } from "next/server";
import { WidgetConfigQuerySchema, type ApiError, type WidgetConfigResponse } from "@askwell/shared";
import { protectWidgetRequest } from "../../../../lib/arcjet";
import { getWidgetConfigByKey } from "../../../../lib/widget/config";

// Public route: any origin may read it, no credentials (project.md §9 CORS).
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

function errorResponse(status: number, code: ApiError["error"]["code"], message: string) {
  const body: ApiError = { error: { code, message } };
  return NextResponse.json(body, {
    status,
    headers: { ...CORS_HEADERS, "Cache-Control": "no-store" },
  });
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { ...CORS_HEADERS, "Access-Control-Max-Age": "86400" },
  });
}

export async function GET(request: Request) {
  const parsed = WidgetConfigQuerySchema.safeParse({
    key: new URL(request.url).searchParams.get("key"),
  });
  if (!parsed.success)
    return errorResponse(400, "validation_failed", "A valid public key is required.");

  // Rate limit per public key + IP, before any database work. Arcjet errors fail open.
  const limit = await protectWidgetRequest(request, {
    route: "config",
    publicKey: parsed.data.key,
  });
  if (limit.status === "rate_limited") {
    return errorResponse(429, "rate_limited", "Too many requests. Try again in a minute.");
  }

  let config: WidgetConfigResponse | null;
  try {
    config = await getWidgetConfigByKey(parsed.data.key);
  } catch {
    return errorResponse(500, "internal", "Something went wrong.");
  }
  if (!config) return errorResponse(404, "not_found", "Unknown key.");

  return NextResponse.json(config, { headers: { ...CORS_HEADERS, "Cache-Control": "no-cache" } });
}
