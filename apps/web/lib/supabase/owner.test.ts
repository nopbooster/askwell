import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn<(...args: unknown[]) => unknown>(() => ({ marker: "client" }));
vi.mock("@supabase/supabase-js", () => ({ createClient: (...a: unknown[]) => createClient(...a) }));

const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));

import { createOwnerClient } from "./owner";

beforeEach(() => {
  createClient.mockClear();
  auth.mockReset();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
});

describe("createOwnerClient", () => {
  it("sends the signed-in owner's Clerk token, with the publishable key", async () => {
    auth.mockResolvedValue({ userId: "user_1", getToken: async () => "clerk-token" });
    await createOwnerClient();
    const [url, key, options] = createClient.mock.calls[0] as [
      string,
      string,
      { accessToken: () => Promise<string> },
    ];
    expect(url).toBe("https://example.supabase.co");
    expect(key).toBe("sb_publishable_test");
    await expect(options.accessToken()).resolves.toBe("clerk-token");
  });

  it("throws when nobody is signed in", async () => {
    auth.mockResolvedValue({ userId: null, getToken: async () => null });
    await expect(createOwnerClient()).rejects.toThrow(/no signed-in owner/);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("fails the request, not silently anonymous, when Clerk has no token", async () => {
    auth.mockResolvedValue({ userId: "user_1", getToken: async () => null });
    await createOwnerClient();
    const options = (createClient.mock.calls[0] as unknown[])[2] as { accessToken: () => Promise<string> };
    await expect(options.accessToken()).rejects.toThrow(/no session token/);
  });

  it("names the missing public variable", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    auth.mockResolvedValue({ userId: "user_1", getToken: async () => "t" });
    await expect(createOwnerClient()).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
