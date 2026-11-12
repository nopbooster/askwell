"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { themeForPath } from "./theme";
import { useTheme, usePreference } from "./use-theme";

/**
 * Keeps the `dark` class on <html> in step with the preference, the OS and the route.
 * On pages that manage their own look (landing, /embed) it removes the class.
 */
export function ThemeController() {
  const pathname = usePathname();
  const preference = usePreference();
  const effective = useTheme();

  useEffect(() => {
    const theme = themeForPath(pathname, preference, effective === "dark");
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [pathname, preference, effective]);

  return null;
}
