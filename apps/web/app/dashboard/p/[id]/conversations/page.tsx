import type { Metadata } from "next";
import { EmptyState, PageHeader } from "../../../../../components/ui";

export const metadata: Metadata = { title: "Conversations" };

export default function Page() {
  return (
    <>
      <PageHeader title="Conversations" description="What visitors asked, and what the bot answered." />
      <EmptyState title="No conversations yet" description="Chats from your widget will show up here." />
    </>
  );
}
