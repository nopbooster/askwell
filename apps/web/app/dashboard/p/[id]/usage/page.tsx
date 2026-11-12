import type { Metadata } from "next";
import { EmptyState, PageHeader } from "../../../../../components/ui";

export const metadata: Metadata = { title: "Usage" };

export default function Page() {
  return (
    <>
      <PageHeader title="Usage" description="Messages used this month." />
      <EmptyState title="No usage yet" description="Your monthly message count will show up here." />
    </>
  );
}
