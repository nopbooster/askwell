import type { Metadata } from "next";
import { EmptyState, PageHeader } from "../../components/ui";

export const metadata: Metadata = { title: "Projects" };

export default function Page() {
  return (
    <>
      <PageHeader title="Projects" description="Your chat widgets, one per website." />
      <EmptyState title="No projects yet" description="You'll create one here soon." />
    </>
  );
}
