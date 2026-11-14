import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { applyPlan, DEFAULT_WIDGET_CONFIG, IdParamsSchema } from "@askwell/shared";
import { CustomizeForm } from "../../../../../components/customize";
import { ErrorState, PageHeader } from "../../../../../components/ui";
import { getOwnerPlan } from "../../../../../lib/accounts";
import { getOwnedProject } from "../../../../../lib/projects";
import { createOwnerClient } from "../../../../../lib/supabase/owner";
import { mapWidgetConfigRow } from "../../../../../lib/widget/config";

export const metadata: Metadata = { title: "Customize" };

const HEADER = <PageHeader title="Customize" description="Make the widget match your brand." />;

export default async function Page({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const parsed = IdParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const project = await getOwnedProject(parsed.data.id);
  if (!project) notFound();

  // The plan is read on the server. The saved config comes through the owner client (RLS).
  const planState = await getOwnerPlan();
  const { data, error } = await (await createOwnerClient())
    .from("widget_configs")
    .select("button_color, position, label, animation, header_text, show_badge")
    .eq("project_id", project.id)
    .maybeSingle();

  if (planState.status !== "ok" || error) {
    return (
      <>
        {HEADER}
        <ErrorState title="Can't load your widget settings" description="Reload the page. If it keeps happening, contact support." />
      </>
    );
  }

  const stored = data ? mapWidgetConfigRow(data) : DEFAULT_WIDGET_CONFIG;
  // Start from what the widget really shows: Free gets the defaults, whatever is stored.
  return (
    <>
      {HEADER}
      <CustomizeForm projectId={project.id} plan={planState.plan} initialConfig={applyPlan(stored, planState.plan)} />
    </>
  );
}
