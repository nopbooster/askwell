export type NavItem = {
  key: string;
  label: string;
  href: string;
  active: boolean;
  /** Tabs of the current project, nested under "Projects". Empty outside a project. */
  children: NavItem[];
};

export const PROJECT_TABS = [
  { key: "knowledge", label: "Knowledge" },
  { key: "install", label: "Install" },
  { key: "customize", label: "Customize" },
  { key: "conversations", label: "Conversations" },
  { key: "usage", label: "Usage" },
] as const;

const PROJECT_PATH = /^\/dashboard\/p\/([^/]+)/;

/** The project id in a dashboard path, or null when the path is not inside a project. */
export function getProjectId(pathname: string): string | null {
  const match = PROJECT_PATH.exec(pathname);
  return match?.[1] ?? null;
}

function isAt(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Sidebar items for the current path. Project tabs appear only inside a project. */
export function getNavItems(pathname: string, projectId: string | null = getProjectId(pathname)): NavItem[] {
  const children: NavItem[] =
    projectId === null
      ? []
      : PROJECT_TABS.map((tab) => {
          const href = `/dashboard/p/${projectId}/${tab.key}`;
          return { key: tab.key, label: tab.label, href, active: isAt(pathname, href), children: [] };
        });

  return [
    {
      key: "projects",
      label: "Projects",
      href: "/dashboard",
      active: pathname === "/dashboard",
      children,
    },
    {
      key: "billing",
      label: "Billing",
      href: "/dashboard/billing",
      active: isAt(pathname, "/dashboard/billing"),
      children: [],
    },
  ];
}
