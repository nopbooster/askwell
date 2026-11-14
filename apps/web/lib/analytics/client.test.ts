import { beforeEach, describe, expect, it, vi } from "vitest";

const initPostHog = vi.fn<() => Promise<boolean>>();
vi.mock("../posthog/client", () => ({ initPostHog: () => initPostHog() }));

const posthog = vi.hoisted(() => ({ get_distinct_id: vi.fn(), identify: vi.fn(), capture: vi.fn() }));
vi.mock("posthog-js", () => ({ default: posthog }));

import { trackClient } from "./client";

beforeEach(() => {
  initPostHog.mockReset().mockResolvedValue(true);
  posthog.get_distinct_id.mockReset().mockReturnValue("anon_123");
  posthog.identify.mockReset();
  posthog.capture.mockReset();
});

describe("trackClient", () => {
  it("identifies by Clerk user ID, then captures", async () => {
    await trackClient("snippet_copied", "user_1", { project_id: "p1" });
    expect(posthog.identify).toHaveBeenCalledWith("user_1");
    expect(posthog.capture).toHaveBeenCalledWith("snippet_copied", { project_id: "p1" });
  });

  it("doesn't re-identify an already identified user", async () => {
    posthog.get_distinct_id.mockReturnValue("user_1");
    await trackClient("snippet_copied", "user_1", { project_id: "p1" });
    expect(posthog.identify).not.toHaveBeenCalled();
    expect(posthog.capture).toHaveBeenCalledTimes(1);
  });

  it("captures anonymously when there's no user ID", async () => {
    await trackClient("snippet_copied", null, { project_id: "p1" });
    expect(posthog.identify).not.toHaveBeenCalled();
    expect(posthog.capture).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when PostHog isn't configured", async () => {
    initPostHog.mockResolvedValue(false);
    await trackClient("snippet_copied", "user_1", { project_id: "p1" });
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("never throws when PostHog fails", async () => {
    posthog.capture.mockImplementation(() => {
      throw new Error("blocked");
    });
    await expect(trackClient("snippet_copied", "user_1", { project_id: "p1" })).resolves.toBeUndefined();
  });
});
