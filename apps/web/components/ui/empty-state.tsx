import type { ReactNode } from "react";
import { GlassPanel } from "./glass-panel";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <GlassPanel className="flex flex-col items-center px-6 py-12 text-center">
      <h2 className="text-base font-medium">{title}</h2>
      {description ? <p className="mt-1 max-w-sm text-sm text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </GlassPanel>
  );
}
