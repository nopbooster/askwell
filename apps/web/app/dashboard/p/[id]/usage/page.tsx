import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IdParamsSchema } from "@askwell/shared";
import { ErrorState, PageHeader } from "../../../../../components/ui";
import { UsageCard } from "../../../../../components/usage";
import { getOwnerPlan } from "../../../../../lib/accounts";
import { getOwnedProject } from "../../../../../lib/projects";
import { toUsageSummary } from "../../../../../lib/usage";

export const metadata: Metadata = { title: "Usage" };
// The count changes with every chat message and the stale-period check depends on today's date.
export const dynamic = "force-dynamic";

const HEADER = <PageHeader title="Usage" description="Messages used this month." />;

export default async function Page({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const parsed = IdParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  // Owner client (RLS): another owner's project looks the same as a missing one.
  const project = await getOwnedProject(parsed.data.id);
  if (!project) notFound();

  // The plan, and so the limit, is read on the server. Never guess Free on a failed read.
  const planState = await getOwnerPlan();
  if (planState.status !== "ok") {
    return (
      <>
        {HEADER}
        <ErrorState title="Can't load your usage" description="Reload the page. If it keeps happening, contact support." />
      </>
    );
  }

  return (
    <>
      {HEADER}
      <UsageCard usage={toUsageSummary(project, planState.plan, new Date())} />
    </>
  );
}
