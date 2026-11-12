/**
 * Route lists for the auth proxy (project.md §8). Plain functions so they can be unit tested.
 * Protected: the dashboard and the owner API routes. Everything else is public.
 */

const DASHBOARD_PATTERN = /^\/dashboard(\/.*)?$/;

const OWNER_API_PATTERNS: readonly RegExp[] = [
  /^\/api\/projects(\/.*)?$/,
  /^\/api\/knowledge(\/.*)?$/,
  /^\/api\/conversations(\/.*)?$/,
];

const PUBLIC_PATTERNS: readonly RegExp[] = [
  /^\/$/,
  /^\/sign-in(\/.*)?$/,
  /^\/sign-up(\/.*)?$/,
  /^\/embed(\/.*)?$/,
  /^\/api\/widget\/.*$/,
  /^\/api\/clerk\/webhook$/,
  /^\/api\/posthog-config$/,
];

export function isDashboardRoute(pathname: string): boolean {
  return DASHBOARD_PATTERN.test(pathname);
}

export function isOwnerApiRoute(pathname: string): boolean {
  return OWNER_API_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function isProtectedRoute(pathname: string): boolean {
  return isDashboardRoute(pathname) || isOwnerApiRoute(pathname);
}

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PATTERNS.some((pattern) => pattern.test(pathname));
}
