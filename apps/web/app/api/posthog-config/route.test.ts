import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiErrorSchema, PosthogConfigResponseSchema } from "@askwell/shared";
import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/posthog-config", () => {
  it("returns the key and host from the environment at request time", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_first");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");
    let res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(PosthogConfigResponseSchema.parse(await res.json())).toEqual({
      key: "phc_first",
      host: "https://us.i.posthog.com",
    });
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_second");
    res = GET();
    expect((await res.json()).key).toBe("phc_second");
  });

  it("returns a 503 error body when the variables are missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "");
    const res = GET();
    expect(res.status).toBe(503);
    expect(ApiErrorSchema.safeParse(await res.json()).success).toBe(true);
  });
});
