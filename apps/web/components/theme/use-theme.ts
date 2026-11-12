"use client";

import { useSyncExternalStore } from "react";
import {
  parsePreference,
  resolveTheme,
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  type Theme,
  type ThemePreference,
} from "./theme";

const QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  window.addEventListener("storage", onChange);
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    media.removeEventListener("change", onChange);
  };
}

export function readPreference(): ThemePreference {
  try {
    return parsePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

export function readSystemDark(): boolean {
  return window.matchMedia(QUERY).matches;
}

export function setPreference(preference: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage blocked: the choice lasts until reload.
  }
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function usePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, readPreference, () => "system");
}

/** Effective theme from the stored preference and the OS setting. */
export function useTheme(): Theme {
  return useSyncExternalStore(
    subscribe,
    () => resolveTheme(readPreference(), readSystemDark()),
    () => "light",
  );
}
