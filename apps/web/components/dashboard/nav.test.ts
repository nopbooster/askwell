import { describe, expect, it } from "vitest";
import { getNavItems, getProjectId } from "./nav";

describe("getProjectId", () => {
  it("reads the id inside a project", () => {
    expect(getProjectId("/dashboard/p/abc/knowledge")).toBe("abc");
  });
  it("is null outside a project", () => {
    expect(getProjectId("/dashboard")).toBeNull();
    expect(getProjectId("/dashboard/billing")).toBeNull();
  });
});

describe("getNavItems", () => {
  it("shows Projects and Billing, no tabs, on the project list", () => {
    const items = getNavItems("/dashboard");
    expect(items.map((i) => i.key)).toEqual(["projects", "billing"]);
    expect(items[0]).toMatchObject({ active: true, children: [] });
    expect(items[1]?.active).toBe(false);
  });

  it("nests the five tabs under Projects inside a project", () => {
    const [projects] = getNavItems("/dashboard/p/abc/install");
    expect(projects?.active).toBe(false);
    expect(projects?.children.map((c) => c.key)).toEqual([
      "knowledge",
      "install",
      "customize",
      "conversations",
      "usage",
    ]);
    expect(projects?.children.map((c) => c.href)).toContain("/dashboard/p/abc/usage");
  });

  it("marks only the current tab active", () => {
    const [projects] = getNavItems("/dashboard/p/abc/customize");
    expect(projects?.children.filter((c) => c.active).map((c) => c.key)).toEqual(["customize"]);
  });

  it("marks Billing active and shows no tabs on the billing page", () => {
    const items = getNavItems("/dashboard/billing");
    expect(items[1]?.active).toBe(true);
    expect(items[0]).toMatchObject({ active: false, children: [] });
  });

  it("does not treat a similar prefix as the same tab", () => {
    const [projects] = getNavItems("/dashboard/p/abc/usage-old");
    expect(projects?.children.some((c) => c.active)).toBe(false);
  });
});
