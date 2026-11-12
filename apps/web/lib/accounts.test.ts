import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));

// A tiny in-memory `accounts` table that behaves like insert ... on conflict do nothing.
const rows = new Map<string, Record<string, unknown>>();
type UpsertResult = { error: { message: string } | null };
const upsert = vi.fn<
  (row: { clerk_user_id: string }, opts: { onConflict: string; ignoreDuplicates: boolean }) => Promise<UpsertResult>
>(async (row) => {
  if (!rows.has(row.clerk_user_id)) rows.set(row.clerk_user_id, { plan: "free", ...row });
  return { error: null };
});
const serviceFrom = vi.fn<(table: string) => { upsert: typeof upsert }>(() => ({ upsert }));
vi.mock("./supabase/service", () => ({ createServiceClient: () => ({ from: serviceFrom }) }));

const ownerResult = vi.fn();
const ownerFrom = vi.fn<(table: string) => { select: (cols: string) => { maybeSingle: () => unknown } }>(() => ({
  select: () => ({ maybeSingle: () => ownerResult() }),
}));
const createOwnerClient = vi.fn(async () => ({ from: ownerFrom }));
vi.mock("./supabase/owner", () => ({ createOwnerClient: () => createOwnerClient() }));

import { ensureAccount, getOwnerPlan } from "./accounts";

beforeEach(() => {
  rows.clear();
  auth.mockReset();
  upsert.mockClear();
  serviceFrom.mockClear();
  ownerResult.mockReset();
  createOwnerClient.mockClear();
  auth.mockResolvedValue({ userId: "user_1" });
});

describe("ensureAccount", () => {
  it("creates the row for a new user, once", async () => {
    await ensureAccount();
    expect(serviceFrom).toHaveBeenCalledWith("accounts");
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(rows.size).toBe(1);
    expect(rows.get("user_1")).toMatchObject({ clerk_user_id: "user_1", plan: "free" });
  });

  it("is a no-op the second time: still one row, plan untouched", async () => {
    await ensureAccount();
    const existing = rows.get("user_1");
    if (existing) existing.plan = "pro"; // the webhook upgraded them
    await ensureAccount();
    expect(rows.size).toBe(1);
    expect(rows.get("user_1")?.plan).toBe("pro");
  });

  it("uses insert-on-conflict-do-nothing", async () => {
    await ensureAccount();
    expect(upsert.mock.calls[0]?.[1]).toEqual({ onConflict: "clerk_user_id", ignoreDuplicates: true });
  });

  it("never sends plan", async () => {
    await ensureAccount();
    await ensureAccount();
    for (const [row] of upsert.mock.calls) {
      expect(Object.keys(row)).toEqual(["clerk_user_id"]);
    }
  });

  it("throws with no session and writes nothing", async () => {
    auth.mockResolvedValue({ userId: null });
    await expect(ensureAccount()).rejects.toThrow(/no signed-in owner/);
    expect(serviceFrom).not.toHaveBeenCalled();
  });

  it("throws when the insert fails", async () => {
    upsert.mockResolvedValueOnce({ error: { message: "boom" } });
    await expect(ensureAccount()).rejects.toThrow(/boom/);
  });
});

describe("getOwnerPlan", () => {
  it("reads the plan through the owner client", async () => {
    ownerResult.mockResolvedValue({ data: { plan: "free" }, error: null });
    await expect(getOwnerPlan()).resolves.toEqual({ status: "ok", plan: "free" });
    expect(createOwnerClient).toHaveBeenCalledTimes(1);
    expect(ownerFrom).toHaveBeenCalledWith("accounts");
    expect(serviceFrom).not.toHaveBeenCalled();
  });

  it("returns pro for a pro account", async () => {
    ownerResult.mockResolvedValue({ data: { plan: "pro" }, error: null });
    await expect(getOwnerPlan()).resolves.toEqual({ status: "ok", plan: "pro" });
  });

  it("returns an error state when the read fails, instead of throwing", async () => {
    ownerResult.mockResolvedValue({ data: null, error: { message: "denied" } });
    await expect(getOwnerPlan()).resolves.toEqual({ status: "error" });
  });

  it("returns an error state when there is no row", async () => {
    ownerResult.mockResolvedValue({ data: null, error: null });
    await expect(getOwnerPlan()).resolves.toEqual({ status: "error" });
  });

  it("returns an error state when the client cannot be created", async () => {
    createOwnerClient.mockRejectedValueOnce(new Error("no session"));
    await expect(getOwnerPlan()).resolves.toEqual({ status: "error" });
  });
});
