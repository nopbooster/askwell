import { redirect } from "next/navigation";

export default async function ProjectIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/p/${id}/knowledge`);
}
