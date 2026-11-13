/** Where PostHog may load. Never in the widget iframe: it runs on customers' sites. */
export function isEmbedPath(pathname: string): boolean {
  return /^\/embed(\/|$)/.test(pathname);
}

/** Session replay runs on the landing page and the dashboard only (project.md §6.11). */
export function isReplayPath(pathname: string): boolean {
  return pathname === "/" || /^\/dashboard(\/|$)/.test(pathname);
}
