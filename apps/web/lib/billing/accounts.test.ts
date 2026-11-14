import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { upsert } = vi.hoisted(() => ({ upsert: vi.fn() }));
vi.mock("../supabase/service", () => ({ createServiceClient: () => ({ from: () => ({ upsert }) }) }));

import { setAccountPlan } from "./accounts";

describe("setAccountPlan", () => {
  it("upserts the plan by Clerk user id (creates the row if the owner never loaded the dashboard)", async () => {
    upsert.mockResolvedValue({ error: null });
    await setAccountPlan("user_abc", "pro");
    expect(upsert).toHaveBeenCalledWith({ clerk_user_id: "user_abc", plan: "pro" }, { onConflict: "clerk_user_id" });
  });
  it("throws on a database error", async () => {
    upsert.mockResolvedValue({ error: { message: "down" } });
    await expect(setAccountPlan("user_abc", "free")).rejects.toThrow("down");
  });
});
