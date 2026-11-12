import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { IdParamsSchema } from "@askwell/shared";
import { getOwnedProject } from "../../../../lib/projects";
import { ProjectActions } from "../../../../components/projects";

export default async function ProjectLayout({
  children,
  params,
}: Readonly<{ children: ReactNode; params: Promise<{ id: string }> }>) {
  const parsed = IdParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  // Owner client: another owner's project looks the same as a missing one.
  const project = await getOwnedProject(parsed.data.id);
  if (!project) notFound();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <p className="min-w-0 text-sm text-fg-muted">
          Project <span className="font-medium break-words text-fg">{project.name}</span>
        </p>
        <ProjectActions project={{ id: project.id, name: project.name }} redirectAfterDelete />
      </div>
      {children}
    </>
  );
}
