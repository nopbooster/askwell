"use client";

import { useState } from "react";
import type { KnowledgeSource } from "@askwell/shared";
import { Button, GlassPanel } from "../ui";
import { callApi } from "../projects/api";
import { formatCreatedDate } from "../projects/limits";
import { failedMessage, statusView, STATUS_LABELS, TYPE_LABELS, type StatusView } from "./helpers";

const BADGE: Record<StatusView, string> = {
  processing: "border-line text-fg-muted",
  ready: "border-line bg-surface-strong text-fg",
  failed: "border-danger text-danger",
};

function StatusBadge({ source }: { source: KnowledgeSource }) {
  const view = statusView(source.status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-control border px-2 py-0.5 text-xs font-medium ${BADGE[view]}`}>
      {view === "processing" ? <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-current" /> : null}
      {STATUS_LABELS[view]}
    </span>
  );
}

function Row({ source, onRemoved }: { source: KnowledgeSource; onRemoved: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const view = statusView(source.status);

  async function remove() {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await callApi("DELETE", `/api/knowledge/${source.id}`);
    // A 404 means it is already gone: treat it as deleted.
    if (result.ok || result.code === "not_found") {
      onRemoved(source.id);
      return;
    }
    setPending(false);
    setError(result.message);
  }

  return (
    <li className="px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-48">
          {/* The title is user input: rendered as text only. */}
          <p className="font-medium break-words">{source.title}</p>
          <p className="text-xs text-fg-muted">
            {TYPE_LABELS[source.type]} · {formatCreatedDate(source.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge source={source} />
          {confirming ? null : (
            <Button variant="ghost" className="min-h-9" onClick={() => setConfirming(true)} aria-label={`Delete ${source.title}`}>
              Delete
            </Button>
          )}
        </div>
      </div>
      {view === "failed" ? <p className="mt-2 text-sm text-fg-muted">{failedMessage(source.type)}</p> : null}
      {confirming ? (
        <div role="alertdialog" aria-label={`Delete ${source.title}`} className="mt-3 space-y-2">
          <p className="text-sm">Delete this source? The bot forgets it. This can&apos;t be undone.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="text-danger" disabled={pending} onClick={remove}>
              {pending ? "Deleting…" : "Delete source"}
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {error !== null ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </li>
  );
}

export function SourceList({ sources, onRemoved }: { sources: KnowledgeSource[]; onRemoved: (id: string) => void }) {
  return (
    <GlassPanel className="overflow-hidden">
      <ul className="divide-y divide-line">
        {sources.map((s) => (
          <Row key={s.id} source={s} onRemoved={onRemoved} />
        ))}
      </ul>
    </GlassPanel>
  );
}
