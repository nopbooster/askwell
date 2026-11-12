import { describe, expect, it } from "vitest";
import { getNavItems, getProjectId } from "./nav";

const PROJECTS = [
  { id: "abc", name: "My site" },
  { id: "def", name: "<b>Other</b>" },
];

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
  it("shows Projects and Billing on the project list, with each real project and no tabs", () => {
    const items = getNavItems("/dashboard", PROJECTS);
    expect(items.map((i) => i.key)).toEqual(["projects", "billing"]);
    expect(items[0]).toMatchObject({ active: true, current: true });
    expect(items[0]?.children.map((c) => c.label)).toEqual(["My site", "<b>Other</b>"]);
    expect(items[0]?.children.every((c) => c.children.length === 0 && !c.current)).toBe(true);
    expect(items[1]?.active).toBe(false);
  });

  it("works with no projects yet", () => {
    expect(getNavItems("/dashboard", [])[0]?.children).toEqual([]);
  });

  it("nests the five tabs under the open project only", () => {
    const [projects] = getNavItems("/dashboard/p/abc/install", PROJECTS);
    expect(projects).toMatchObject({ active: false, current: true });
    const [open, other] = projects?.children ?? [];
    expect(open).toMatchObject({ label: "My site", current: true, active: false });
    expect(open?.children.map((c) => c.key)).toEqual(["knowledge", "install", "customize", "conversations", "usage"]);
    expect(open?.children.map((c) => c.href)).toContain("/dashboard/p/abc/usage");
    expect(other).toMatchObject({ current: false, children: [] });
  });

  it("links a project to its Knowledge tab", () => {
    const [projects] = getNavItems("/dashboard", PROJECTS);
    expect(projects?.children[0]?.href).toBe("/dashboard/p/abc/knowledge");
  });

  it("marks only the current tab active", () => {
    const [projects] = getNavItems("/dashboard/p/abc/customize", PROJECTS);
    const tabs = projects?.children[0]?.children ?? [];
    expect(tabs.filter((c) => c.active).map((c) => c.key)).toEqual(["customize"]);
  });

  it("marks Billing active and shows no tabs on the billing page", () => {
    const items = getNavItems("/dashboard/billing", PROJECTS);
    expect(items[1]).toMatchObject({ active: true, current: true });
    expect(items[0]).toMatchObject({ active: false, current: false });
    expect(items[0]?.children.every((c) => c.children.length === 0)).toBe(true);
  });

  it("does not treat a similar prefix as the same tab", () => {
    const [projects] = getNavItems("/dashboard/p/abc/usage-old", PROJECTS);
    expect(projects?.children[0]?.children.some((c) => c.active)).toBe(false);
  });

  it("still shows the open project's tabs when the list is stale", () => {
    const [projects] = getNavItems("/dashboard/p/zzz/knowledge", PROJECTS);
    expect(projects?.children[0]).toMatchObject({ key: "project-zzz", current: true });
    expect(projects?.children[0]?.children).toHaveLength(5);
  });
});
