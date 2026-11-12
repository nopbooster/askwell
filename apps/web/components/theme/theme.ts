import { APP_NAME } from "@askwell/shared";

/**
 * Pure theme logic. Only the dashboard, sign-in and sign-up follow the theme.
 * The landing page is always dark (own `.dark` scope) and /embed is always light.
 */
export type ThemePreference = "light" | "dark" | "system";
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = `${APP_NAME.toLowerCase()}-theme`;
export const THEME_CHANGE_EVENT = `${APP_NAME.toLowerCase()}-theme-change`;

const THEMED_PATH = /^\/(dashboard|sign-in|sign-up)(\/|$)/;

export function parsePreference(raw: string | null | undefined): ThemePreference {
  return raw === "light" || raw === "dark" ? raw : "system";
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): Theme {
  if (preference === "system") return systemDark ? "dark" : "light";
  return preference;
}

export function isThemedPath(pathname: string): boolean {
  return THEMED_PATH.test(pathname);
}

/** The theme to apply to <html> for a page, or null when the page manages its own look. */
export function themeForPath(
  pathname: string,
  raw: string | null | undefined,
  systemDark: boolean,
): Theme | null {
  return isThemedPath(pathname) ? resolveTheme(parsePreference(raw), systemDark) : null;
}

/** Inline script for <head>: sets the `dark` class before first paint. Mirrors themeForPath. */
export const THEME_INIT_SCRIPT = `(function(){try{if(!${THEMED_PATH.toString()}.test(location.pathname))return;var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=s==="dark"||(s!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark")}catch(e){}})()`;
