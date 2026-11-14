import Link from "next/link";
import { GlassPanel } from "../ui";

/** Free plan: the form stays visible but locked. Billing is where they upgrade. */
export function LockedNotice({ message }: { message?: string }) {
  return (
    <GlassPanel className="flex flex-wrap items-center justify-between gap-3 p-4" role="status" data-testid="locked-notice">
      <div className="min-w-0">
        <p className="text-sm font-medium">Customizing the widget is a Pro feature</p>
        <p className="text-sm text-fg-muted">
          {message ?? "On Free, your widget uses the default look and shows the badge. Upgrade to change it."}
        </p>
      </div>
      <Link
        href="/dashboard/billing"
        className="inline-flex min-h-10 items-center rounded-control bg-accent px-4 text-sm font-medium text-accent-fg shadow-raised hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
      >
        Upgrade to Pro
      </Link>
    </GlassPanel>
  );
}
