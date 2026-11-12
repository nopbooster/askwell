import Link from "next/link";
import type { Plan } from "@askwell/shared";
import { GlassPanel } from "../ui";
import { sourceLimitLabel } from "./helpers";

/**
 * Shown instead of the add forms when the plan's source limit is reached. Same look as the project
 * `UpgradePrompt` (whose label is about projects, so it can't be reused as is). Pro has no upgrade.
 */
export function SourceLimitPrompt({ count, plan, message }: { count: number; plan: Plan; message?: string }) {
  return (
    <GlassPanel className="flex flex-wrap items-center justify-between gap-3 p-4" role="status">
      <div className="min-w-0">
        <p className="text-sm font-medium">{sourceLimitLabel(count, plan)}</p>
        <p className="text-sm text-fg-muted">
          {message ?? (plan === "free" ? "Upgrade to Pro to add more sources." : "Delete a source to add another.")}
        </p>
      </div>
      {plan === "free" ? (
        <Link
          href="/dashboard/billing"
          className="inline-flex min-h-10 items-center rounded-control bg-accent px-4 text-sm font-medium text-accent-fg shadow-raised hover:opacity-90"
        >
          Upgrade to Pro
        </Link>
      ) : null}
    </GlassPanel>
  );
}
