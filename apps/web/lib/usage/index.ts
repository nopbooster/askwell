import { PLAN_LIMITS, type Plan } from "@askwell/shared";

/** Start of the UTC calendar month containing `now`. Matches `consume_message`'s month (Postgres, UTC). */
export function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** When the count resets: the start of the next UTC month (December rolls over to January). */
export function nextUtcMonthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/**
 * Messages used this month. A `period_start` before the current UTC month is a stale period:
 * `consume_message` resets it on the next message, so the real count is 0 until then.
 */
export function messagesUsedThisMonth(messagesUsed: number, periodStart: string, now: Date): number {
  const start = Date.parse(periodStart);
  if (Number.isNaN(start) || start < startOfUtcMonth(now).getTime()) return 0;
  return Math.max(0, messagesUsed);
}

/** Share of the limit used, as a whole percent from 0 to 100 (rounded down, so 100 means the limit is hit). */
export function usagePercent(used: number, limit: number): number {
  if (limit <= 0) return 100;
  return Math.min(100, Math.max(0, Math.floor((used / limit) * 100)));
}

export type UsageSummary = {
  used: number;
  limit: number;
  percent: number;
  quotaReached: boolean;
  /** ISO timestamp of the next reset (start of next UTC month). */
  resetsAt: string;
  plan: Plan;
};

/**
 * What the Usage page shows. The limit comes from `PLAN_LIMITS` for the plan read on the server,
 * never from the client.
 */
export function toUsageSummary(
  project: { messages_used: number; period_start: string },
  plan: Plan,
  now: Date,
): UsageSummary {
  const limit = PLAN_LIMITS[plan].messagesPerMonth;
  const used = messagesUsedThisMonth(project.messages_used, project.period_start, now);
  return {
    used,
    limit,
    percent: usagePercent(used, limit),
    quotaReached: used >= limit,
    resetsAt: nextUtcMonthStart(now).toISOString(),
    plan,
  };
}
