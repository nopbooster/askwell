"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { snippetCopied } from "../../lib/analytics";
import { trackClient } from "../../lib/analytics/client";
import { Button, GlassPanel } from "../ui";

export function CopySnippet({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const codeRef = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { userId } = useAuth();
  const params = useParams<{ id?: string }>();
  const projectId = typeof params?.id === "string" ? params.id : null;

  useEffect(() => () => clearTimeout(timer.current), []);

  function selectAll() {
    const el = codeRef.current;
    const sel = window.getSelection();
    if (!el || !sel) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  async function copy() {
    setFailed(false);
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
      if (projectId) void trackClient("snippet_copied", userId, snippetCopied({ projectId }));
    } catch {
      // Clipboard blocked: select the text so Ctrl/Cmd+C works.
      selectAll();
      setFailed(true);
    }
  }

  return (
    <GlassPanel className="p-4 sm:p-6">
      <pre className="overflow-x-auto rounded-control bg-surface p-3 text-sm" tabIndex={0}>
        <code ref={codeRef} data-testid="install-snippet" onClick={selectAll}>
          {snippet}
        </code>
      </pre>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={copy}>{copied ? "Copied" : "Copy"}</Button>
        <span role="status" aria-live="polite" className="text-sm text-fg-muted">
          {copied ? "Copied to clipboard." : failed ? "Couldn't copy. The text is selected: press Ctrl+C or ⌘C." : ""}
        </span>
      </div>
    </GlassPanel>
  );
}
