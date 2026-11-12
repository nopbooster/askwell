import type { PlanState } from "../../lib/accounts";

const LABELS = { free: "Free", pro: "Pro" } as const;

/** Small plan badge for the sidebar. A failed plan read shows an error state, not a crash. */
export function PlanBadge({ state }: { state: PlanState }) {
  if (state.status === "error") {
    return (
      <span className="inline-flex rounded-control border border-line px-2 py-0.5 text-xs text-danger" role="status">
        Plan unavailable
      </span>
    );
  }
  return (
    <span
      className="inline-flex rounded-control border border-line bg-surface-strong px-2 py-0.5 text-xs font-medium"
      aria-label={`Plan: ${LABELS[state.plan]}`}
    >
      {LABELS[state.plan]}
    </span>
  );
}
