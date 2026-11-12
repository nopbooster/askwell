"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import {
  CreateProjectRequestSchema,
  MAX_PROJECT_NAME_CHARS,
  type CreateProjectResponse,
  type Plan,
} from "@askwell/shared";
import { Button } from "../ui";
import { callApi } from "./api";
import { isAtProjectLimit } from "./limits";
import { UpgradePrompt } from "./upgrade-prompt";

/**
 * Name + "Create project". At the plan limit it shows the upgrade prompt instead (never a silently
 * disabled button). A 403 `plan_limit_reached` from the API (stale count) shows the same prompt.
 */
export function CreateProjectForm({ count, plan }: { count: number; plan: Plan }) {
  const router = useRouter();
  const inputId = useId();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);

  if (limitMessage !== null || isAtProjectLimit(count, plan)) {
    return <UpgradePrompt count={count} plan={plan} message={limitMessage ?? undefined} />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const parsed = CreateProjectRequestSchema.safeParse({ name });
    if (!parsed.success) {
      setError(`Enter a project name (1 to ${MAX_PROJECT_NAME_CHARS} characters).`);
      return;
    }
    setError(null);
    setPending(true);
    const result = await callApi<CreateProjectResponse>("POST", "/api/projects", parsed.data);
    if (result.ok) {
      router.push(`/dashboard/p/${result.data.project.id}/knowledge`);
      router.refresh();
      return; // stay "pending" while the page changes
    }
    setPending(false);
    if (result.code === "plan_limit_reached") setLimitMessage(result.message);
    else setError(result.message);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3" noValidate>
      <div className="min-w-0 flex-1 basis-56">
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium">
          Project name
        </label>
        <input
          id={inputId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_PROJECT_NAME_CHARS}
          placeholder="My website"
          autoComplete="off"
          aria-invalid={error !== null}
          aria-describedby={error !== null ? `${inputId}-error` : undefined}
          className="glass min-h-10 w-full rounded-control px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create project"}
      </Button>
      {error !== null ? (
        <p id={`${inputId}-error`} role="alert" className="basis-full text-sm text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}
