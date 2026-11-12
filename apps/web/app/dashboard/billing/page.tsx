import type { Metadata } from "next";
import { EmptyState, PageHeader } from "../../../components/ui";

export const metadata: Metadata = { title: "Billing" };

export default function Page() {
  return (
    <>
      <PageHeader title="Billing" description="Your plan and subscription." />
      <EmptyState title="Billing is empty for now" description="Plans and checkout will show up here." />
    </>
  );
}
