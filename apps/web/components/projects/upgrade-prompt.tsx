import Link from "next/link";
import type { Plan } from "@askwell/shared";
import { GlassPanel } from "../ui";
import { projectLimitLabel } from "./limits";

/** Shown instead of the create form when the plan's project limit is reached. */
export function UpgradePrompt({ count, plan, message }: { count: number; plan: Plan; message?: string }) {
  return (
    <GlassPanel className="flex flex-wrap items-center justify-between gap-3 p-4" role="status">
      <div className="min-w-0">
        <p className="text-sm font-medium">{projectLimitLabel(count, plan)}</p>
        <p className="text-sm text-fg-muted">{message ?? "Upgrade to Pro to create more projects."}</p>
      </div>
      <Link
        href="/dashboard/billing"
        className="inline-flex min-h-10 items-center rounded-control bg-accent px-4 text-sm font-medium text-accent-fg shadow-raised hover:opacity-90"
      >
        Upgrade to Pro
      </Link>
    </GlassPanel>
  );
}
