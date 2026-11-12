import type { Metadata } from "next";
import { EmptyState, PageHeader } from "../../../../../components/ui";

export const metadata: Metadata = { title: "Customize" };

export default function Page() {
  return (
    <>
      <PageHeader title="Customize" description="Make the widget match your brand." />
      <EmptyState title="Nothing to customize yet" description="Widget settings will appear here." />
    </>
  );
}
