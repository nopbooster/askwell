import { ApiErrorSchema, type ApiErrorCode } from "@askwell/shared";

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; code: ApiErrorCode | "network"; message: string };

const GENERIC = "Something went wrong. Try again.";

/** Turns a failed response into a code + message the UI can show. Never throws. */
export async function readApiError(response: Response): Promise<{ code: ApiErrorCode | "network"; message: string }> {
  try {
    const parsed = ApiErrorSchema.safeParse(await response.json());
    if (parsed.success) return parsed.data.error;
  } catch {
    // not JSON: fall through
  }
  return { code: "internal", message: GENERIC };
}

/** Calls one of our owner routes. Network failures and error bodies become `{ ok: false }`. */
export async function callApi<T = unknown>(method: "POST" | "PATCH" | "DELETE", url: string, body?: unknown): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, code: "network", message: "Could not reach the server. Check your connection and try again." };
  }
  if (!response.ok) return { ok: false, status: response.status, ...(await readApiError(response)) };
  return { ok: true, status: response.status, data: (await response.json()) as T };
}
