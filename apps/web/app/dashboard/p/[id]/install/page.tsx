import type { Metadata } from "next";
import { EmptyState, PageHeader } from "../../../../../components/ui";

export const metadata: Metadata = { title: "Install" };

export default function Page() {
  return (
    <>
      <PageHeader title="Install" description="Add the widget to your website." />
      <EmptyState title="Nothing to install yet" description="Your script tag will appear here." />
    </>
  );
}
