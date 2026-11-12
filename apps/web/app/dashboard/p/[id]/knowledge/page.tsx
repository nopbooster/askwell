import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IdParamsSchema } from "@askwell/shared";
import { KnowledgeManager } from "../../../../../components/knowledge";
import { toKnowledgeSource } from "../../../../../lib/knowledge/source";
import { ErrorState, PageHeader } from "../../../../../components/ui";
import { getOwnerPlan } from "../../../../../lib/accounts";
import { getOwnedProject } from "../../../../../lib/projects";
import { createOwnerClient } from "../../../../../lib/supabase/owner";

export const metadata: Metadata = { title: "Knowledge" };

const HEADER = <PageHeader title="Knowledge" description="What the bot knows about your site." />;

export default async function Page({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const parsed = IdParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const project = await getOwnedProject(parsed.data.id);
  if (!project) notFound();

  // Owner client, so RLS scopes the rows; the plan is read on the server.
  const planState = await getOwnerPlan();
  const { data, error } = await (await createOwnerClient())
    .from("knowledge_sources")
    .select("id, title, type, status, created_at")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });

  if (planState.status !== "ok" || error) {
    return (
      <>
        {HEADER}
        <ErrorState title="Can't load your knowledge" description="Reload the page. If it keeps happening, contact support." />
      </>
    );
  }

  return (
    <>
      {HEADER}
      <KnowledgeManager projectId={project.id} initialSources={data.map(toKnowledgeSource)} plan={planState.plan} />
    </>
  );
}
