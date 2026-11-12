"use client";

import { useRef, useState, type DragEvent } from "react";
import {
  MAX_KNOWLEDGE_FILE_BYTES,
  type FinalizeKnowledgeResponse,
  type KnowledgeSource,
  type UploadUrlResponse,
} from "@askwell/shared";
import { Button, GlassPanel } from "../ui";
import { callApi } from "../projects/api";
import { uploadToSignedUrl } from "./api";
import { ACCEPT_ATTRIBUTE, checkFile, formatSize, titleFromFileName } from "./helpers";

type Phase = { name: "idle" } | { name: "uploading"; fraction: number } | { name: "checking" };

/**
 * Pick or drop a file. Flow: `upload-url` (reserves the source) → the file goes straight to the signed
 * Storage URL → `finalize`. Type and size are checked here first for a quick message; the server checks
 * again. If the upload itself fails, the reservation is deleted so it doesn't use up the limit.
 */
export function UploadBox({
  projectId,
  onChanged,
  onSettled,
  onLimit,
}: {
  projectId: string;
  /** A source was added or updated. */
  onChanged: (source: KnowledgeSource) => void;
  /** An upload failed after the reservation: the server cleaned up, so reload the real list. */
  onSettled: () => void;
  onLimit: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const busy = phase.name !== "idle";

  async function upload(file: File) {
    if (busy) return;
    const check = checkFile(file);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    setError(null);
    setPhase({ name: "uploading", fraction: 0 });

    const reserved = await callApi<UploadUrlResponse>("POST", `/api/projects/${projectId}/knowledge/upload-url`, {
      title: titleFromFileName(file.name),
      fileName: file.name,
      sizeBytes: file.size,
    });
    if (!reserved.ok) {
      setPhase({ name: "idle" });
      if (reserved.code === "plan_limit_reached") onLimit(reserved.message);
      else setError(reserved.message);
      return;
    }
    const { source, uploadUrl } = reserved.data;
    onChanged(source);

    const sent = await uploadToSignedUrl(uploadUrl, file, check.mimeType, (fraction) =>
      setPhase({ name: "uploading", fraction }),
    );
    if (!sent.ok) {
      // Give the slot back; the server removes any partial file too.
      await callApi("DELETE", `/api/knowledge/${source.id}`);
      setPhase({ name: "idle" });
      setError("The upload failed. Check your connection and try again.");
      onSettled();
      return;
    }

    setPhase({ name: "checking" });
    const finalized = await callApi<FinalizeKnowledgeResponse>("POST", `/api/projects/${projectId}/knowledge/finalize`, {
      sourceId: source.id,
    });
    setPhase({ name: "idle" });
    if (finalized.ok) onChanged(finalized.data.source);
    else {
      setError(finalized.message);
      onSettled();
    }
  }

  function onPick(files: FileList | null) {
    const file = files?.[0];
    if (file) void upload(file);
    if (inputRef.current) inputRef.current.value = ""; // so picking the same file again works
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (!busy) onPick(event.dataTransfer.files);
  }

  return (
    <GlassPanel className="p-4 sm:p-5">
      <h2 className="text-base font-medium">Upload a file</h2>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`mt-3 flex flex-col items-center gap-2 rounded-control border border-dashed px-4 py-8 text-center ${
          dragging ? "border-fg bg-surface-strong" : "border-line"
        }`}
      >
        <p className="text-sm text-fg-muted">
          Drop a PDF, Markdown or TXT file here, up to {formatSize(MAX_KNOWLEDGE_FILE_BYTES)}.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose a file"
          onChange={(e) => onPick(e.target.files)}
        />
        <Button variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
          {phase.name === "uploading"
            ? `Uploading… ${Math.round(phase.fraction * 100)}%`
            : phase.name === "checking"
              ? "Checking file…"
              : "Choose file"}
        </Button>
        {phase.name === "uploading" ? (
          <div
            role="progressbar"
            aria-label="Upload progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(phase.fraction * 100)}
            className="h-1.5 w-full max-w-xs overflow-hidden rounded-control bg-line"
          >
            <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.round(phase.fraction * 100)}%` }} />
          </div>
        ) : null}
      </div>
      {error !== null ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </GlassPanel>
  );
}
