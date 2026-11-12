"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KnowledgeSource, Plan } from "@askwell/shared";
import { EmptyState } from "../ui";
import { fetchSources } from "./api";
import { AddTextForm } from "./add-text-form";
import { hasProcessing, isAtSourceLimit, POLL_INTERVAL_MS, shouldKeepPolling, sourceLimitLabel } from "./helpers";
import { SourceLimitPrompt } from "./limit-prompt";
import { SourceList } from "./source-list";
import { UploadBox } from "./upload-box";

/**
 * The Knowledge tab. Starts from the server-rendered list, then polls `GET .../knowledge` every
 * 2.5 s while any source is processing. `shouldKeepPolling` is the stop rule.
 */
export function KnowledgeManager({
  projectId,
  initialSources,
  plan,
}: {
  projectId: string;
  initialSources: KnowledgeSource[];
  plan: Plan;
}) {
  const [sources, setSources] = useState(initialSources);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [pollStopped, setPollStopped] = useState(false);
  // Bumped on every local change, so a poll that started before it can't overwrite the change.
  const version = useRef(0);
  const pollStartedAt = useRef<number | null>(null);

  const upsert = useCallback((source: KnowledgeSource) => {
    version.current += 1;
    setSources((current) =>
      current.some((s) => s.id === source.id) ? current.map((s) => (s.id === source.id ? source : s)) : [source, ...current],
    );
    pollStartedAt.current = null; // new work restarts the polling clock
    setPollStopped(false);
  }, []);

  const remove = useCallback((id: string) => {
    version.current += 1;
    setSources((current) => current.filter((s) => s.id !== id));
    setLimitMessage(null); // a slot is free again
  }, []);

  /** Reloads the list once (after a failed upload, or a limit answer from a stale count). */
  const reload = useCallback(async () => {
    const started = version.current;
    const fresh = await fetchSources(projectId);
    if (fresh !== null && version.current === started) setSources(fresh);
  }, [projectId]);

  const onLimit = useCallback(
    (message: string) => {
      setLimitMessage(message);
      void reload();
    },
    [reload],
  );

  const polling = hasProcessing(sources) && !pollStopped;
  useEffect(() => {
    if (!polling) return;
    pollStartedAt.current ??= Date.now();
    let cancelled = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      const started = version.current;
      const fresh = await fetchSources(projectId);
      if (cancelled) return;
      let latest: KnowledgeSource[] | null = null;
      if (fresh === null) failures += 1;
      else {
        failures = 0;
        if (version.current === started) {
          latest = fresh;
          setSources(fresh);
        }
      }
      pollStartedAt.current ??= Date.now(); // a local change reset the clock
      // Keep going on what we know: the fresh list, or (if the answer was dropped) assume still processing.
      const stillProcessing = latest ?? [{ status: "processing" as const }];
      if (shouldKeepPolling(stillProcessing, Date.now() - pollStartedAt.current, failures)) {
        timer = setTimeout(tick, POLL_INTERVAL_MS);
      } else if (hasProcessing(stillProcessing)) {
        setPollStopped(true); // gave up while something is still processing
      }
    }
    timer = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [polling, projectId]);

  const atLimit = limitMessage !== null || isAtSourceLimit(sources.length, plan);

  return (
    <div className="space-y-6">
      <p className="text-sm text-fg-muted">{sourceLimitLabel(sources.length, plan)}</p>

      {atLimit ? (
        <SourceLimitPrompt count={sources.length} plan={plan} message={limitMessage ?? undefined} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <AddTextForm projectId={projectId} onAdded={upsert} onLimit={onLimit} />
          <UploadBox projectId={projectId} onChanged={upsert} onSettled={reload} onLimit={onLimit} />
        </div>
      )}

      {pollStopped ? (
        <p role="status" className="text-sm text-fg-muted">
          Status updates paused. Reload the page to check again.
        </p>
      ) : null}

      {sources.length === 0 ? (
        <EmptyState
          title="No knowledge yet"
          description="Paste text or upload a PDF, Markdown or TXT file. The bot answers visitors from what you add here."
        />
      ) : (
        <SourceList sources={sources} onRemoved={remove} />
      )}
    </div>
  );
}
