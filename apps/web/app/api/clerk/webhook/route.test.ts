import { createHmac, randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { setAccountPlan, clerk } = vi.hoisted(() => ({
  setAccountPlan: vi.fn(),
  /** Clerk's CURRENT truth for the user, as the Backend API would answer it. */
  clerk: { plan: "pro" as "pro" | "free", fail: null as Error | null, calls: [] as string[] },
}));
vi.mock("../../../../lib/billing/accounts", () => ({ setAccountPlan }));
vi.mock("../../../../lib/billing/clerk", () => ({
  currentPlanFromClerk: async (userId: string) => {
    clerk.calls.push(userId);
    if (clerk.fail) throw clerk.fail;
    return clerk.plan;
  },
}));

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
  clerk.plan = "pro";
  clerk.fail = null;
  clerk.calls = [];
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/clerk/webhook — signed events sync the plan from Clerk's current subscription", () => {
  it("Pro item active, Clerk says pro → sets pro, 200", async () => {
    const res = await POST(signed(proItem("subscriptionItem.active")));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(clerk.calls).toEqual(["user_abc"]);
    expect(setAccountPlan).toHaveBeenCalledExactlyOnceWith("user_abc", "pro");
  });
  it("Pro item ended, Clerk says free → sets free", async () => {
    clerk.plan = "free";
    const res = await POST(signed(proItem("subscriptionItem.ended", { status: "ended" })));
    expect(res.status).toBe(200);
    expect(setAccountPlan).toHaveBeenCalledExactlyOnceWith("user_abc", "free");
  });
  it("canceled in the paid period: Clerk still says pro → keeps pro", async () => {
    const res = await POST(signed(proItem("subscriptionItem.canceled", { status: "canceled" })));
    expect(res.status).toBe(200);
    expect(setAccountPlan).toHaveBeenCalledExactlyOnceWith("user_abc", "pro");
  });
  it("the Free item ending on an upgrade can't downgrade: the plan comes from Clerk (pro)", async () => {
    const res = await POST(signed(proItem("subscriptionItem.ended", { plan: { slug: "free_user" } })));
    expect(res.status).toBe(200);
    expect(setAccountPlan).toHaveBeenCalledExactlyOnceWith("user_abc", "pro");
  });
  it("other event types → ignored, no Clerk call, no write, 200", async () => {
    const res = await POST(signed({ type: "user.created", object: "event", data: { id: "user_abc" } }));
    expect(res.status).toBe(200);
    expect(clerk.calls).toEqual([]);
    expect(setAccountPlan).not.toHaveBeenCalled();
  });
  it("an organization payer → ignored, no Clerk call", async () => {
    const res = await POST(signed(proItem("subscriptionItem.active", { payer: { organization_id: "org_1" } })));
    expect(res.status).toBe(200);
    expect(clerk.calls).toEqual([]);
    expect(setAccountPlan).not.toHaveBeenCalled();
  });
  it("Clerk's API fails → 500 so Clerk retries, nothing written", async () => {
    clerk.fail = new Error("clerk down");
    const res = await POST(signed(proItem("subscriptionItem.ended", { status: "ended" })));
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("internal");
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
  it("logs the Clerk delivery id (svix-id) with the event type and the synced plan", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const req = signed(proItem("subscriptionItem.active"));
    await POST(req);
    expect(log).toHaveBeenCalledWith("[clerk/webhook]", req.headers.get("svix-id"), "subscriptionItem.active", "sync → pro", "subscriptionItem.active (pro)");
  });
});

describe("POST /api/clerk/webhook — late and retried events can't set the wrong plan (review §3)", () => {
  const OLD = { id: "csi_old", status: "ended" };
  const NEW = { id: "csi_new", status: "active" };
  /** The plan the account ends with after these deliveries, in order. */
  async function deliver(...events: unknown[]) {
    for (const e of events) expect((await POST(signed(e))).status).toBe(200);
    return setAccountPlan.mock.calls.at(-1)?.[1];
  }

  it("scenario 1, stale ended after a new active: the paying owner stays pro", async () => {
    clerk.plan = "pro"; // truth: new item B is active
    expect(await deliver(proItem("subscriptionItem.active", NEW), proItem("subscriptionItem.ended", OLD))).toBe("pro");
  });
  it("scenario 1, other order (old ended first, then new active): pro", async () => {
    clerk.plan = "pro";
    expect(await deliver(proItem("subscriptionItem.ended", OLD), proItem("subscriptionItem.active", NEW))).toBe("pro");
  });
  it("scenario 2, stale active after the item ended: stays free (no plan bypass)", async () => {
    clerk.plan = "free"; // truth: nothing paid any more
    expect(await deliver(proItem("subscriptionItem.ended", { id: "csi_a", status: "ended" }), proItem("subscriptionItem.active", { id: "csi_a", status: "active" }))).toBe("free");
  });
  it("scenario 2, other order (stale active first, then ended): free", async () => {
    clerk.plan = "free";
    expect(await deliver(proItem("subscriptionItem.active", { id: "csi_a" }), proItem("subscriptionItem.ended", { id: "csi_a", status: "ended" }))).toBe("free");
  });
  it("every write equals Clerk's truth at that moment, whatever the event says", async () => {
    clerk.plan = "free";
    await deliver(proItem("subscriptionItem.active"));
    clerk.plan = "pro";
    await deliver(proItem("subscriptionItem.ended", { status: "ended" }));
    expect(setAccountPlan.mock.calls.map((c) => c[1])).toEqual(["free", "pro"]);
  });
});

describe("POST /api/clerk/webhook — unverified requests change nothing", () => {
  const expectRejected = async (res: Response) => {
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { code: "unauthorized", message: "Invalid webhook signature." } });
    expect(setAccountPlan).not.toHaveBeenCalled();
    expect(clerk.calls).toEqual([]); // no Clerk API call for an unverified request either
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
