"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversationSummary } from "@askwell/shared";
import { Button, EmptyState, ErrorState, GlassPanel, LoadingState } from "../ui";
import { fetchConversations, fetchThread } from "./api";
import { ConversationList } from "./conversation-list";
import { nextThreadState, threadWhileRefreshing, type ThreadState } from "./state";
import { ThreadView } from "./thread-view";

/**
 * The Conversations tab: the list (server-rendered first, newest first) and the selected thread.
 * Refresh re-reads the list and the open thread; there is no realtime (project.md §6.7). On small
 * screens the thread replaces the list, with a Back button.
 */
export function ConversationsView({
  projectId,
  initialConversations,
}: {
  projectId: string;
  initialConversations: ConversationSummary[];
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadState>({ status: "idle" });
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  // Only the latest thread request may write: a slow answer for an earlier pick is dropped.
  const threadRequest = useRef(0);
  const threadPane = useRef<HTMLDivElement>(null);

  const loadThread = useCallback(async (id: string, keepVisible: boolean) => {
    const request = ++threadRequest.current;
    setThread((current) => (keepVisible ? threadWhileRefreshing(current, id) : { status: "loading", id }));
    const result = await fetchThread(id);
    if (request !== threadRequest.current) return;
    setThread((current) => nextThreadState(current, id, result, keepVisible));
    return result.ok;
  }, []);

  const select = useCallback(
    (id: string) => {
      setSelectedId(id);
      void loadThread(id, false);
    },
    [loadThread],
  );

  // On a small screen the thread replaces the list: bring its top into view.
  useEffect(() => {
    if (selectedId === null) return;
    const pane = threadPane.current;
    if (pane && window.matchMedia("(max-width: 1023px)").matches) pane.scrollIntoView({ block: "start" });
  }, [selectedId]);

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshFailed(false);
    const [list, threadOk] = await Promise.all([
      fetchConversations(projectId),
      selectedId === null ? Promise.resolve(true) : loadThread(selectedId, true),
    ]);
    if (list.ok) setConversations(list.data);
    setRefreshFailed(!list.ok || threadOk === false);
    setRefreshing(false);
  }

  const refreshBar = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-fg-muted">
        {conversations.length === 0 ? "" : `Newest ${conversations.length.toLocaleString("en-US")} shown, newest first.`}
      </p>
      <div className="flex items-center gap-3">
        {refreshFailed ? (
          <p role="alert" className="text-sm text-danger">
            Couldn&apos;t refresh. Try again.
          </p>
        ) : null}
        <Button variant="secondary" onClick={refresh} disabled={refreshing} aria-busy={refreshing}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>
    </div>
  );

  if (conversations.length === 0) {
    return (
      <div className="space-y-4">
        {refreshBar}
        <EmptyState
          title="No conversations yet"
          description="Chats from your widget show up here. Install the widget, send a test message, then press Refresh."
        />
      </div>
    );
  }

  const open = selectedId !== null;
  return (
    <div className="space-y-4">
      {refreshBar}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
        <div className={open ? "hidden lg:block" : undefined}>
          <ConversationList conversations={conversations} selectedId={selectedId} onSelect={select} />
        </div>
        <div ref={threadPane} className={`scroll-mt-4 space-y-3 ${open ? "" : "hidden lg:block"}`}>
          {open ? (
            <Button variant="ghost" className="-ml-2 lg:hidden" onClick={() => setSelectedId(null)}>
              ← All conversations
            </Button>
          ) : null}
          <ThreadPane state={thread} onRetry={selectedId === null ? undefined : () => void loadThread(selectedId, false)} />
        </div>
      </div>
    </div>
  );
}

function ThreadPane({ state, onRetry }: { state: ThreadState; onRetry?: () => void }) {
  switch (state.status) {
    case "idle":
      return (
        <GlassPanel className="px-6 py-12 text-center text-sm text-fg-muted">Pick a conversation to read it.</GlassPanel>
      );
    case "loading":
      return <LoadingState rows={5} />;
    case "missing":
      return <EmptyState title="Conversation not found" description="It may have been deleted. Press Refresh to update the list." />;
    case "error":
      return <ErrorState title="Couldn't load this conversation" onRetry={onRetry} />;
    case "ready":
      return <ThreadView thread={state.thread} />;
  }
}
