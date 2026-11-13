import Link from "next/link";
import { PLAN_LIMITS } from "@askwell/shared";
import type { UsageSummary } from "../../lib/usage";
import { GlassPanel } from "../ui";

const numberFormat = new Intl.NumberFormat("en-US");
/** The reset is midnight UTC, so the date is shown in UTC (otherwise it can read a day early). */
const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });

export function formatResetDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

export function UsageCard({ usage }: { usage: UsageSummary }) {
  const { used, limit, percent, quotaReached, resetsAt, plan } = usage;
  const resetDate = formatResetDate(resetsAt);

  return (
    <div className="space-y-4">
      <GlassPanel className="p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium text-fg-muted">Messages this month</h2>
          <span className="text-xs text-fg-muted">{plan === "pro" ? "Pro plan" : "Free plan"}</span>
        </div>
        <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
          {numberFormat.format(used)}
          <span className="text-base font-normal text-fg-muted"> / {numberFormat.format(limit)}</span>
        </p>

        <div
          className="mt-4 h-2 w-full overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-label="Messages used this month"
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={used}
          aria-valuetext={`${used} of ${limit} messages (${percent}%)`}
        >
          <div
            className={`h-full rounded-full transition-[width] ${quotaReached ? "bg-danger" : "bg-accent"}`}
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm text-fg-muted">
          <span className="tabular-nums">{percent}% used</span>
          <span>Resets on {resetDate}</span>
        </div>

        {used === 0 ? (
          <p className="mt-4 text-sm text-fg-muted">
            No messages yet this month. Each visitor message the bot answers counts as one.
          </p>
        ) : null}
      </GlassPanel>

      {quotaReached ? (
        <GlassPanel className="p-6" role="status">
          <h2 className="text-base font-medium text-danger">Monthly limit reached</h2>
          <p className="mt-1 text-sm text-fg-muted">
            Visitors see a message that the chat has reached its limit. Answers start again on {resetDate}.
          </p>
          {plan === "free" ? (
            <p className="mt-3 text-sm">
              <Link href="/dashboard/billing" className="font-medium underline underline-offset-4">
                Upgrade to Pro
              </Link>{" "}
              for {numberFormat.format(PLAN_LIMITS.pro.messagesPerMonth)} messages a month.
            </p>
          ) : null}
        </GlassPanel>
      ) : null}
    </div>
  );
}
