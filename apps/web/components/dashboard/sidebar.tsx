"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { APP_NAME } from "@askwell/shared";
import { Button } from "../ui/button";
import { getNavItems, type NavItem } from "./nav";

function NavLink({ item, nested = false }: { item: NavItem; nested?: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={item.active ? "page" : undefined}
      className={`block rounded-control px-3 py-2 text-sm transition ${nested ? "ml-3" : ""} ${
        item.active ? "bg-accent font-medium text-accent-fg" : "text-fg-muted hover:bg-surface-strong hover:text-fg"
      }`}
    >
      {item.label}
    </Link>
  );
}

function NavList({ items }: { items: NavItem[] }) {
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.key}>
          <NavLink item={item} />
          {item.children.length > 0 ? (
            <ul className="mt-1 space-y-1 border-l border-line">
              {item.children.map((child) => (
                <li key={child.key}>
                  <NavLink item={child} nested />
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  // The menu is open only for the path it was opened on, so navigating closes it.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const items = getNavItems(pathname);

  return (
    <>
      <div className="glass sticky top-0 z-20 flex items-center justify-between px-4 py-3 md:hidden">
        <span className="font-semibold">{APP_NAME}</span>
        <div className="flex items-center gap-2">
          <UserButton />
          <Button
            variant="secondary"
            aria-expanded={open}
            aria-controls="dashboard-nav"
            onClick={() => setOpenAt(open ? null : pathname)}
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
        <div className="hidden px-3 md:block">
          <UserButton />
        </div>
      </aside>
    </>
  );
}
