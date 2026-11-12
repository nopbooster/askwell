"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { APP_NAME } from "@askwell/shared";
import { ThemeToggle } from "../theme/theme-toggle";
import { Button } from "../ui/button";
import { getNavItems, type NavItem, type NavProject } from "./nav";

function NavLink({ item }: { item: NavItem }) {
  const style = item.active
    ? "bg-accent font-medium text-accent-fg"
    : item.current
      ? "font-medium text-fg hover:bg-surface-strong"
      : "text-fg-muted hover:bg-surface-strong hover:text-fg";
  return (
    <Link
      href={item.href}
      aria-current={item.active ? "page" : undefined}
      title={item.label}
      className={`block truncate rounded-control px-3 py-2 text-sm transition ${style}`}
    >
      {item.label}
    </Link>
  );
}

function NavList({ items, nested = false }: { items: NavItem[]; nested?: boolean }) {
  return (
    <ul className={nested ? "mt-1 ml-3 space-y-1 border-l border-line" : "space-y-1"}>
      {items.map((item) => (
        <li key={item.key}>
          <NavLink item={item} />
          {item.children.length > 0 ? <NavList items={item.children} nested /> : null}
        </li>
      ))}
    </ul>
  );
}

export function Sidebar({
  badge,
  projects = [],
}: {
  badge?: ReactNode;
  projects?: readonly NavProject[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Navigating closes the menu. Reset during render (not in an effect) so it never flashes open.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }
  const items = getNavItems(pathname, projects);

  return (
    <>
      <div className="glass sticky top-0 z-20 flex items-center justify-between px-4 py-3 md:hidden">
        <span className="flex items-center gap-2 font-semibold">
          {APP_NAME}
          {badge}
        </span>
        <div className="flex items-center gap-2">
          <UserButton />
          <Button
            variant="secondary"
            aria-expanded={open}
            aria-controls="dashboard-nav"
            onClick={() => setOpen(!open)}
          >
            {open ? "Close" : "Menu"}
          </Button>
        </div>
      </div>

      <aside
        id="dashboard-nav"
        className={`glass z-10 w-full flex-col gap-6 p-4 md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:rounded-none md:border-y-0 md:border-l-0 ${
          open ? "flex" : "hidden"
        }`}
      >
        <span className="hidden px-3 text-lg font-semibold md:block">{APP_NAME}</span>
        <nav aria-label="Dashboard" className="flex-1">
          <NavList items={items} />
        </nav>
        <ThemeToggle />
        <div className="hidden items-center gap-2 px-3 md:flex">
          <UserButton />
          {badge}
        </div>
      </aside>
    </>
  );
}
