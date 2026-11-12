import { PLAN_LIMITS, type Plan } from "@askwell/shared";

const PLAN_NAMES = { free: "Free", pro: "Pro" } as const;

/** "1 of 1 projects on Free". */
export function projectLimitLabel(count: number, plan: Plan): string {
  const limit = PLAN_LIMITS[plan].projects;
  return `${count} of ${limit} ${limit === 1 ? "project" : "projects"} on ${PLAN_NAMES[plan]}`;
}

/** True when the owner can't create another project on this plan. */
export function isAtProjectLimit(count: number, plan: Plan): boolean {
  return count >= PLAN_LIMITS[plan].projects;
}

/** "3 of 100 messages this month". */
export function messagesLabel(used: number, limit: number): string {
  return `${used} of ${limit} ${limit === 1 ? "message" : "messages"} this month`;
}

/** "Nov 12, 2026". Fixed to UTC so the server and the browser render the same text. */
export function formatCreatedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}
