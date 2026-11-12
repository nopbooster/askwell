import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLAN_LIMITS } from "@askwell/shared";
import { fakeQuery, type QueryResult } from "./test-helpers";

vi.mock("server-only", () => ({}));

let result: QueryResult = { data: null, error: null };
let last: ReturnType<typeof fakeQuery>;
vi.mock("../supabase/owner", () => ({
  createOwnerClient: async () => ({
    from: () => {
      last = fakeQuery(result);
      return last.builder;
    },
  }),
}));

import { getOwnedProject, toProject } from "./index";

const ROW = {
  id: "11111111-1111-4111-8111-111111111111",
  owner_id: "user_1",
  name: "Site",
  public_key: "pk_abcdefghijklmnopqrstuvwx",
  messages_used: 7,
  period_start: "2026-11-01T00:00:00+00:00",
  created_at: "2026-11-12T10:00:00+00:00",
};

beforeEach(() => {
  result = { data: ROW, error: null };
});

describe("toProject", () => {
  it("maps columns to the shared shape and takes the message limit from the plan", () => {
    expect(toProject(ROW, "free")).toEqual({
      id: ROW.id,
      name: "Site",
      publicKey: ROW.public_key,
      messagesUsed: 7,
      messagesLimit: PLAN_LIMITS.free.messagesPerMonth,
      periodStart: ROW.period_start,
      createdAt: ROW.created_at,
    });
    expect(toProject(ROW, "pro").messagesLimit).toBe(PLAN_LIMITS.pro.messagesPerMonth);
  });

  it("never exposes the owner id", () => {
    expect(Object.keys(toProject(ROW, "free"))).not.toContain("owner_id");
    expect(Object.keys(toProject(ROW, "free"))).not.toContain("ownerId");
  });
});

describe("getOwnedProject", () => {
  it("returns the row the owner client finds", async () => {
    await expect(getOwnedProject(ROW.id)).resolves.toEqual(ROW);
    expect(last.calls.eq).toEqual([["id", ROW.id]]);
  });

  it("returns null when RLS hides it or it doesn't exist", async () => {
    result = { data: null, error: null };
    await expect(getOwnedProject(ROW.id)).resolves.toBeNull();
  });

  it("throws on a database error", async () => {
    result = { data: null, error: { message: "boom" } };
    await expect(getOwnedProject(ROW.id)).rejects.toThrow("boom");
  });
});
