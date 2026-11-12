"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { MAX_PROJECT_NAME_CHARS, UpdateProjectRequestSchema } from "@askwell/shared";
import { Button } from "../ui";
import { callApi } from "./api";

type Mode = "idle" | "rename" | "delete";

/**
 * Rename (inline) and delete (with a confirm step) for one project. Mutations go through the
 * API routes; afterwards the server data is refreshed. `redirectAfterDelete` is set when this is
 * shown on a project page, so the owner doesn't stay on a page that no longer exists.
 * The name is user input: it is only ever rendered as text.
 */
export function ProjectActions({
  project,
  redirectAfterDelete = false,
}: {
  project: { id: string; name: string };
  redirectAfterDelete?: boolean;
}) {
  const router = useRouter();
  const inputId = useId();
  const [mode, setMode] = useState<Mode>("idle");
  const [name, setName] = useState(project.name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open(next: Mode) {
    setName(project.name);
    setError(null);
    setMode(next);
  }

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const parsed = UpdateProjectRequestSchema.safeParse({ name });
    if (!parsed.success) {
      setError(`Enter a project name (1 to ${MAX_PROJECT_NAME_CHARS} characters).`);
      return;
    }
    setPending(true);
    setError(null);
    const result = await callApi("PATCH", `/api/projects/${project.id}`, parsed.data);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMode("idle");
    router.refresh();
  }

  async function remove() {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await callApi("DELETE", `/api/projects/${project.id}`);
    if (!result.ok && result.code !== "not_found") {
      setPending(false);
      setError(result.message);
      return;
    }
    // A 404 means it is already gone: treat it as deleted.
    if (redirectAfterDelete) router.push("/dashboard");
    router.refresh();
  }

  if (mode === "rename") {
    return (
      <form onSubmit={rename} className="flex flex-wrap items-end gap-2" noValidate>
        <div className="min-w-0 flex-1 basis-40">
          <label htmlFor={inputId} className="sr-only">
            New name for {project.name}
          </label>
          <input
            id={inputId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_PROJECT_NAME_CHARS}
            autoFocus
            autoComplete="off"
            aria-invalid={error !== null}
            className="glass min-h-10 w-full rounded-control px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button variant="ghost" disabled={pending} onClick={() => open("idle")}>
          Cancel
        </Button>
        {error !== null ? (
          <p role="alert" className="basis-full text-sm text-danger">
            {error}
          </p>
        ) : null}
      </form>
    );
  }

  if (mode === "delete") {
    return (
      <div role="alertdialog" aria-label={`Delete ${project.name}`} className="space-y-3">
        <p className="text-sm">
          Delete <strong className="font-semibold break-words">{project.name}</strong>? Its knowledge and
          conversations are deleted too. This can&apos;t be undone.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="text-danger" disabled={pending} onClick={remove}>
            {pending ? "Deleting…" : "Delete project"}
          </Button>
          <Button variant="ghost" disabled={pending} onClick={() => open("idle")}>
            Cancel
          </Button>
        </div>
        {error !== null ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={() => open("rename")} aria-label={`Rename ${project.name}`}>
        Rename
      </Button>
      <Button variant="ghost" onClick={() => open("delete")} aria-label={`Delete ${project.name}`}>
        Delete
      </Button>
    </div>
  );
}
