import { GlassPanel } from "./glass-panel";

export function LoadingState({ rows = 3 }: { rows?: number }) {
  return (
    <GlassPanel className="space-y-3 p-6" role="status" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-4 animate-pulse rounded-control bg-line" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </GlassPanel>
  );
}
