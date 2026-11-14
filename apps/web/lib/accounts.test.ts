import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));

// A tiny in-memory `accounts` table that behaves like insert ... on conflict do nothing ... returning:
// the returned rows are only the ones this call inserted.
const rows = new Map<string, Record<string, unknown>>();
type UpsertResult = { data: Array<{ clerk_user_id: string }> | null; error: { message: string } | null };
const upsert = vi.fn<
  (row: { clerk_user_id: string }, opts: { onConflict: string; ignoreDuplicates: boolean }) => Promise<UpsertResult>
>(async (row) => {
  if (rows.has(row.clerk_user_id)) return { data: [], error: null };
  rows.set(row.clerk_user_id, { plan: "free", ...row });
  return { data: [{ clerk_user_id: row.clerk_user_id }], error: null };
});
const select = vi.fn<(cols: string) => void>();
const serviceFrom = vi.fn<(table: string) => unknown>(() => ({
  upsert: (row: { clerk_user_id: string }, opts: { onConflict: string; ignoreDuplicates: boolean }) => ({
    select: (cols: string) => {
      select(cols);
      return upsert(row, opts);
    },
  }),
}));

const trackServer = vi.fn();
vi.mock("./analytics/server", () => ({ trackServer: (...args: unknown[]) => trackServer(...args) }));
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
  select.mockClear();
  serviceFrom.mockClear();
  trackServer.mockReset();
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
    upsert.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await expect(ensureAccount()).rejects.toThrow(/boom/);
    expect(trackServer).not.toHaveBeenCalled();
  });

  it("fires signed_up once, for the Clerk user, only when the row is created", async () => {
    await ensureAccount();
    expect(select).toHaveBeenCalledWith("clerk_user_id");
    expect(trackServer).toHaveBeenCalledTimes(1);
    expect(trackServer).toHaveBeenCalledWith("signed_up", "user_1", {});
    await ensureAccount(); // row already exists: conflict returns no row
    expect(trackServer).toHaveBeenCalledTimes(1);
  });
});

describe("getOwnerPlan", () => {
  it("reads the plan through the owner client", async () => {
    ownerResult.mockResolvedValue({ data: { plan: "free" }, error: null });
    await expect(getOwnerPlan()).resolves.toEqual({ status: "ok", plan: "free" });
    expect(createOwnerClient).toHaveBeenCalledTimes(1);
    expect(ownerFrom).toHaveBeenCalledWith("accounts");
    // The service client only ensures the row; the plan itself is read through the owner client.
    expect(serviceFrom.mock.calls.every(([t]) => t === "accounts")).toBe(true);
    expect(upsert.mock.calls.every(([row]) => !("plan" in row))).toBe(true);
  });

  it("waits for the account insert before reading (new user's first load)", async () => {
    // The insert is slow; the owner read only sees the row once the insert has finished.
    let finishInsert: () => void = () => {};
    upsert.mockImplementationOnce(
      (row) =>
        new Promise<UpsertResult>((resolve) => {
          finishInsert = () => {
            rows.set(row.clerk_user_id, { plan: "free", ...row });
            resolve({ data: [{ clerk_user_id: row.clerk_user_id }], error: null });
          };
        }),
    );
    ownerResult.mockImplementation(() => {
      const row = rows.get("user_1");
      return row ? { data: { plan: row.plan }, error: null } : { data: null, error: null };
    });

    const plan = getOwnerPlan(); // starts before the insert finishes, without calling ensureAccount itself
    await Promise.resolve();
    await Promise.resolve();
    expect(ownerResult).not.toHaveBeenCalled(); // no read yet
    finishInsert();
    await expect(plan).resolves.toEqual({ status: "ok", plan: "free" });
  });

  it("returns an error state when the account can't be created, without guessing Free", async () => {
    upsert.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await expect(getOwnerPlan()).resolves.toEqual({ status: "error" });
    expect(ownerResult).not.toHaveBeenCalled();
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
