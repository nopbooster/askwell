import Link from "next/link";
import { buttonClasses, GlassPanel } from "../ui";

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
        className={buttonClasses()}
      >
        Upgrade to Pro
      </Link>
    </GlassPanel>
  );
}
