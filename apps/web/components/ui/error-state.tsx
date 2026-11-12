import { Button } from "./button";
import { GlassPanel } from "./glass-panel";

export function ErrorState({
  title = "Something went wrong",
  description = "Try again. If it keeps happening, reload the page.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <GlassPanel className="flex flex-col items-center px-6 py-12 text-center" role="alert">
      <h2 className="text-base font-medium text-danger">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-fg-muted">{description}</p>
      {onRetry ? (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </GlassPanel>
  );
}
