import type { Metadata } from "next";
import { getOwnerPlan } from "../../lib/accounts";
import { listOwnedProjects, toProject } from "../../lib/projects";
import { CreateProjectForm, ProjectCard, projectLimitLabel } from "../../components/projects";
import { EmptyState, ErrorState, GlassPanel, PageHeader } from "../../components/ui";

export const metadata: Metadata = { title: "Projects" };

export default async function Page() {
  // Reads go through the owner client (RLS), not a fetch to our own API. A failed read throws to error.tsx.
  const [rows, planState] = await Promise.all([listOwnedProjects(), getOwnerPlan()]);
  if (planState.status !== "ok") {
    return <ErrorState title="Couldn't load your plan" description="Reload the page. If it keeps happening, try again later." />;
  }
  const { plan } = planState;
  const projects = rows.map((row) => toProject(row, plan));

  return (
    <>
      <PageHeader
        title="Projects"
        description={`Your chat widgets, one per website. ${projectLimitLabel(projects.length, plan)}.`}
      />
      {projects.length === 0 ? (
        <EmptyState
          title="Create your first project"
          description="A project is one chat widget for one website. Name it, then add what the bot should know."
          action={<CreateProjectForm count={0} plan={plan} />}
        />
      ) : (
        <div className="space-y-6">
          <GlassPanel className="p-4">
            <CreateProjectForm count={projects.length} plan={plan} />
          </GlassPanel>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <li key={project.id} className="min-w-0">
                <ProjectCard project={project} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
