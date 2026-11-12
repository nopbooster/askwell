import { NextResponse } from "next/server";
import type { ApiError, ApiErrorCode } from "@askwell/shared";

/** The shared `{ error: { code, message } }` response. */
export function apiError(status: number, code: ApiErrorCode, message: string): NextResponse<ApiError> {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** Logs the real error on the server; the client only gets a generic message. */
export function internalError(where: string, cause: unknown): NextResponse<ApiError> {
  console.error(`[${where}]`, cause);
  return apiError(500, "internal", "Something went wrong.");
}

/** Parses the request body as JSON; `undefined` when it isn't valid JSON (the schema then rejects it). */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
