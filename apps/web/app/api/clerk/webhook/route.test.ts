import { createHmac, randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { setAccountPlan } = vi.hoisted(() => ({ setAccountPlan: vi.fn() }));
vi.mock("../../../../lib/billing/accounts", () => ({ setAccountPlan }));

import { POST } from "./route";

// A test signing secret in Clerk's (Svix) format. The real verifyWebhook checks every request.
const KEY = randomBytes(24);
const SECRET = `whsec_${KEY.toString("base64")}`;
const URL = "https://app.test/api/clerk/webhook";

/** A request signed the way Clerk signs deliveries: HMAC-SHA256 over "id.timestamp.body". */
function signed(event: unknown, opts: { secret?: Buffer; body?: string; timestamp?: number } = {}) {
  const body = opts.body ?? JSON.stringify(event);
  const id = `msg_${randomBytes(6).toString("hex")}`;
  const timestamp = String(opts.timestamp ?? Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", opts.secret ?? KEY).update(`${id}.${timestamp}.${JSON.stringify(event)}`).digest("base64");
  return new NextRequest(URL, {
    method: "POST",
    headers: { "content-type": "application/json", "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` },
    body,
  });
}
const proItem = (type: string, over: Record<string, unknown> = {}) => ({
  type,
  object: "event",
  data: {
    object: "commerce_subscription_item",
    id: "csi_1",
    status: "active",
    plan: { id: "cplan_pro", slug: "pro", name: "Pro" },
    payer: { user_id: "user_abc" },
    period_start: Date.now() - 86_400_000,
    period_end: Date.now() + 20 * 86_400_000,
    ...over,
  },
});

beforeEach(() => {
  vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", SECRET);
  setAccountPlan.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/clerk/webhook — signed events", () => {
  it("Pro item active → sets pro, 200", async () => {
    const res = await POST(signed(proItem("subscriptionItem.active")));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(setAccountPlan).toHaveBeenCalledExactlyOnceWith("user_abc", "pro");
  });
  it("Pro item ended → sets free", async () => {
    const res = await POST(signed(proItem("subscriptionItem.ended", { status: "ended" })));
    expect(res.status).toBe(200);
    expect(setAccountPlan).toHaveBeenCalledExactlyOnceWith("user_abc", "free");
  });
  it("canceled in the paid period → keeps pro (no write), 200", async () => {
    const res = await POST(signed(proItem("subscriptionItem.canceled", { status: "canceled" })));
    expect(res.status).toBe(200);
    expect(setAccountPlan).not.toHaveBeenCalled();
  });
  it("another plan's event → ignored, 200", async () => {
    const res = await POST(signed(proItem("subscriptionItem.ended", { plan: { slug: "free_user" } })));
    expect(res.status).toBe(200);
    expect(setAccountPlan).not.toHaveBeenCalled();
  });
  it("other event types → ignored, 200", async () => {
    const res = await POST(signed({ type: "user.created", object: "event", data: { id: "user_abc" } }));
    expect(res.status).toBe(200);
    expect(setAccountPlan).not.toHaveBeenCalled();
  });
  it("a database error → 500, so Clerk retries", async () => {
    setAccountPlan.mockRejectedValue(new Error("db down"));
    const res = await POST(signed(proItem("subscriptionItem.active")));
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("internal");
  });
  it("never logs the payload (it holds the owner's email)", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    await POST(signed(proItem("subscriptionItem.active", { payer: { user_id: "user_abc", email: "owner@example.com" } })));
    expect(JSON.stringify(log.mock.calls)).not.toContain("owner@example.com");
  });
});

describe("POST /api/clerk/webhook — unverified requests change nothing", () => {
  const expectRejected = async (res: Response) => {
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { code: "unauthorized", message: "Invalid webhook signature." } });
    expect(setAccountPlan).not.toHaveBeenCalled();
  };
  it("wrong signing secret → 401", async () => {
    await expectRejected(await POST(signed(proItem("subscriptionItem.active"), { secret: randomBytes(24) })));
  });
  it("body changed after signing → 401", async () => {
    const event = proItem("subscriptionItem.ended");
    const tampered = JSON.stringify({ ...event, data: { ...event.data, payer: { user_id: "user_victim" } } });
    await expectRejected(await POST(signed(event, { body: tampered })));
  });
  it("missing Svix headers → 401", async () => {
    await expectRejected(
      await POST(new NextRequest(URL, { method: "POST", body: JSON.stringify(proItem("subscriptionItem.active")) })),
    );
  });
  it("an old (replayed) timestamp → 401", async () => {
    await expectRejected(await POST(signed(proItem("subscriptionItem.active"), { timestamp: Math.floor(Date.now() / 1000) - 3600 })));
  });
  it("no signing secret configured → 500 (config problem), nothing written", async () => {
    vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", "");
    const res = await POST(signed(proItem("subscriptionItem.active")));
    expect(res.status).toBe(500);
    expect(setAccountPlan).not.toHaveBeenCalled();
  });
});
