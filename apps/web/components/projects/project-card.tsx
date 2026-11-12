import Link from "next/link";
import type { Project } from "@askwell/shared";
import { GlassPanel } from "../ui";
import { formatCreatedDate, messagesLabel } from "./limits";
import { ProjectActions } from "./project-actions";

/** One project in the list. The name is user input, so it is rendered as text only. */
export function ProjectCard({ project }: { project: Project }) {
  return (
    <GlassPanel className="flex flex-col gap-4 p-5">
      <div className="min-w-0">
        <h2 className="text-base font-semibold break-words">
          <Link
            href={`/dashboard/p/${project.id}/knowledge`}
            className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
          >
            {project.name}
          </Link>
        </h2>
        <p className="mt-1 text-sm text-fg-muted">{messagesLabel(project.messagesUsed, project.messagesLimit)}</p>
        <p className="text-sm text-fg-muted">Created {formatCreatedDate(project.createdAt)}</p>
      </div>
      <ProjectActions project={{ id: project.id, name: project.name }} />
    </GlassPanel>
  );
}
