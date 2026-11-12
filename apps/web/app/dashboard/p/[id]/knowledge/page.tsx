import type { Metadata } from "next";
import { EmptyState, PageHeader } from "../../../../../components/ui";

export const metadata: Metadata = { title: "Knowledge" };

export default function Page() {
  return (
    <>
      <PageHeader title="Knowledge" description="What the bot knows about your site." />
      <EmptyState title="No knowledge yet" description="You'll add pages and text here soon." />
    </>
  );
}
