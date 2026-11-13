import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IdParamsSchema } from "@askwell/shared";
import { ConversationsView } from "../../../../../components/conversations";
import { ErrorState, PageHeader } from "../../../../../components/ui";
import { listProjectConversations } from "../../../../../lib/conversations";
import { getOwnedProject } from "../../../../../lib/projects";

export const metadata: Metadata = { title: "Conversations" };
// New chats arrive all the time: never serve a cached list.
export const dynamic = "force-dynamic";

const HEADER = <PageHeader title="Conversations" description="What visitors asked, and what the bot answered." />;

export default async function Page({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const parsed = IdParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  // Owner client (RLS): another owner's project looks the same as a missing one.
  const project = await getOwnedProject(parsed.data.id);
  if (!project) notFound();

  let conversations;
  try {
    conversations = await listProjectConversations(project.id);
  } catch {
    return (
      <>
        {HEADER}
        <ErrorState title="Can't load your conversations" description="Reload the page. If it keeps happening, contact support." />
      </>
    );
  }

  return (
    <>
      {HEADER}
      <ConversationsView projectId={project.id} initialConversations={conversations} />
    </>
  );
}
