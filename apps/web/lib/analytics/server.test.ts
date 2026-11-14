import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const captureServer = vi.fn();
vi.mock("../posthog/server", () => ({
  captureServer: (...args: unknown[]) => captureServer(...args),
}));

let afterImpl: (task: () => unknown) => void;
vi.mock("next/server", () => ({ after: (task: () => unknown) => afterImpl(task) }));

import { trackServer } from "./server";

const tasks: Array<() => unknown> = [];

beforeEach(() => {
  tasks.length = 0;
  afterImpl = (task) => void tasks.push(task);
  captureServer.mockReset().mockResolvedValue(undefined);
});

describe("trackServer", () => {
  it("sends after the response, identified by the Clerk user ID", async () => {
    trackServer("project_created", "user_1", { project_id: "p1", plan: "pro" });
    expect(captureServer).not.toHaveBeenCalled();
    expect(tasks).toHaveLength(1);
    await tasks[0]?.();
    expect(captureServer).toHaveBeenCalledWith("project_created", "user_1", { project_id: "p1", plan: "pro" });
  });

  it("outside a request scope (after() throws) it sends right away and doesn't throw", () => {
    afterImpl = () => {
      throw new Error("after() called outside a request scope");
    };
    expect(() => trackServer("signed_up", "user_1", {})).not.toThrow();
    expect(captureServer).toHaveBeenCalledWith("signed_up", "user_1", {});
  });

  it("a failing capture never throws, in after() or right away", async () => {
    captureServer.mockRejectedValue(new Error("posthog down"));
    trackServer("signed_up", "user_1", {});
    await expect(Promise.resolve(tasks[0]?.())).resolves.toBeUndefined();
    afterImpl = () => {
      throw new Error("no scope");
    };
    expect(() => trackServer("signed_up", "user_1", {})).not.toThrow();
    await new Promise((r) => setTimeout(r, 0)); // no unhandled rejection
  });
});
