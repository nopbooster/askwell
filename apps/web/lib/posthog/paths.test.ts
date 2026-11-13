import { describe, expect, it } from "vitest";
import { isEmbedPath, isReplayPath } from "./paths";

describe("posthog paths", () => {
  it("flags only /embed as the widget", () => {
    expect(isEmbedPath("/embed")).toBe(true);
    expect(isEmbedPath("/embed/x")).toBe(true);
    expect(isEmbedPath("/embedded")).toBe(false);
    expect(isEmbedPath("/")).toBe(false);
  });
  it("records the landing page and dashboard only", () => {
    expect(isReplayPath("/")).toBe(true);
    expect(isReplayPath("/dashboard")).toBe(true);
    expect(isReplayPath("/dashboard/p/1/conversations")).toBe(true);
    expect(isReplayPath("/sign-in")).toBe(false);
    expect(isReplayPath("/embed")).toBe(false);
    expect(isReplayPath("/dashboards")).toBe(false);
  });
});
