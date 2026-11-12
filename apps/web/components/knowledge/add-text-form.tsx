"use client";

import { useId, useState, type FormEvent } from "react";
import {
  AddKnowledgeTextRequestSchema,
  MAX_KNOWLEDGE_TEXT_CHARS,
  MAX_KNOWLEDGE_TITLE_CHARS,
  type AddKnowledgeTextResponse,
  type KnowledgeSource,
} from "@askwell/shared";
import { Button, GlassPanel } from "../ui";
import { callApi } from "../projects/api";

const FIELD =
  "glass w-full rounded-control px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg";

/** Title + text → POST. The new source comes back `processing` and the manager starts polling. */
export function AddTextForm({
  projectId,
  onAdded,
  onLimit,
}: {
  projectId: string;
  onAdded: (source: KnowledgeSource) => void;
  onLimit: (message: string) => void;
}) {
  const titleId = useId();
  const textId = useId();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const parsed = AddKnowledgeTextRequestSchema.safeParse({ title, text });
    if (!parsed.success) {
      setError(
        `Enter a title (up to ${MAX_KNOWLEDGE_TITLE_CHARS} characters) and some text (up to ${MAX_KNOWLEDGE_TEXT_CHARS.toLocaleString("en-US")} characters).`,
      );
      return;
    }
    setError(null);
    setPending(true);
    const result = await callApi<AddKnowledgeTextResponse>("POST", `/api/projects/${projectId}/knowledge`, parsed.data);
    setPending(false);
    if (result.ok) {
      setTitle("");
      setText("");
      onAdded(result.data.source);
    } else if (result.code === "plan_limit_reached") {
      onLimit(result.message);
    } else {
      setError(result.message);
    }
  }

  return (
    <GlassPanel className="p-4 sm:p-5">
      <h2 className="text-base font-medium">Paste text</h2>
      <form onSubmit={onSubmit} className="mt-3 space-y-3" noValidate>
        <div>
          <label htmlFor={titleId} className="mb-1 block text-sm font-medium">
            Title
          </label>
          <input
            id={titleId}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={MAX_KNOWLEDGE_TITLE_CHARS}
            autoComplete="off"
            className={`${FIELD} min-h-10`}
          />
        </div>
        <div>
          <label htmlFor={textId} className="mb-1 block text-sm font-medium">
            Text
          </label>
          <textarea
            id={textId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_KNOWLEDGE_TEXT_CHARS}
            rows={6}
            className={`${FIELD} py-2`}
          />
        </div>
        {error !== null ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add text"}
        </Button>
      </form>
    </GlassPanel>
  );
}
