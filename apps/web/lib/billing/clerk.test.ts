import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { getUserBillingSubscription } = vi.hoisted(() => ({ getUserBillingSubscription: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ clerkClient: async () => ({ billing: { getUserBillingSubscription } }) }));

import { currentPlanFromClerk } from "./clerk";

const NOW = Date.UTC(2026, 10, 16);
beforeEach(() => {
  getUserBillingSubscription.mockReset();
});

describe("currentPlanFromClerk", () => {
  it("reads the user's current subscription from Clerk's Backend API", async () => {
    getUserBillingSubscription.mockResolvedValue({
      subscriptionItems: [{ status: "active", plan: { slug: "pro" }, periodEnd: NOW + 1e9 }],
    });
    await expect(currentPlanFromClerk("user_abc", NOW)).resolves.toBe("pro");
    expect(getUserBillingSubscription).toHaveBeenCalledWith("user_abc");
  });
  it("a user with no subscription (404) is free", async () => {
    getUserBillingSubscription.mockImplementation(async () => {
      throw Object.assign(new Error("not found"), { status: 404 });
    });
    await expect(currentPlanFromClerk("user_abc", NOW)).resolves.toBe("free");
  });
  it("any other failure throws (the route answers 500 so Clerk retries)", async () => {
    getUserBillingSubscription.mockImplementation(async () => {
      throw Object.assign(new Error("boom"), { status: 503 });
    });
    await expect(currentPlanFromClerk("user_abc", NOW)).rejects.toThrow("boom");
    getUserBillingSubscription.mockImplementation(async () => {
      throw new Error("network");
    });
    await expect(currentPlanFromClerk("user_abc", NOW)).rejects.toThrow("network");
  });
});
