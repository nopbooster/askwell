export type NavItem = {
  key: string;
  label: string;
  href: string;
  /** This exact page (or tab) is open. */
  active: boolean;
  /** This item, or something under it, is open. Used to emphasise the open project. */
  current: boolean;
  /** Projects under "Projects"; the open project's tabs under that project. */
  children: NavItem[];
};

export type NavProject = { id: string; name: string };

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

function projectTabs(pathname: string, projectId: string): NavItem[] {
  return PROJECT_TABS.map((tab) => {
    const href = `/dashboard/p/${projectId}/${tab.key}`;
    const active = isAt(pathname, href);
    return { key: tab.key, label: tab.label, href, active, current: active, children: [] };
  });
}

/**
 * Sidebar items for the current path: Projects (the owner's real projects, newest first, with the
 * open project's tabs nested under it) and Billing. A project open but missing from `projects`
 * (a stale list) is still shown, so its tabs never disappear.
 */
export function getNavItems(
  pathname: string,
  projects: readonly NavProject[] = [],
  projectId: string | null = getProjectId(pathname),
): NavItem[] {
  const entries: NavProject[] = [...projects];
  if (projectId !== null && !entries.some((p) => p.id === projectId)) {
    entries.unshift({ id: projectId, name: "Project" });
  }
  const children: NavItem[] = entries.map((project) => {
    const tabs = project.id === projectId ? projectTabs(pathname, project.id) : [];
    return {
      key: `project-${project.id}`,
      label: project.name,
      href: `/dashboard/p/${project.id}/knowledge`,
      active: false,
      current: project.id === projectId,
      children: tabs,
    };
  });

  return [
    {
      key: "projects",
      label: "Projects",
      href: "/dashboard",
      active: pathname === "/dashboard",
      current: pathname === "/dashboard" || projectId !== null,
      children,
    },
    {
      key: "billing",
      label: "Billing",
      href: "/dashboard/billing",
      active: isAt(pathname, "/dashboard/billing"),
      current: isAt(pathname, "/dashboard/billing"),
      children: [],
    },
  ];
}
