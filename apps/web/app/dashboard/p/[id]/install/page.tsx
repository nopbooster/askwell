import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IdParamsSchema } from "@askwell/shared";
import { CopySnippet, buildInstallSnippet } from "../../../../../components/install";
import { ErrorState, PageHeader } from "../../../../../components/ui";
import { getAppUrl } from "../../../../../lib/app-url";
import { getOwnedProject } from "../../../../../lib/projects";

export const metadata: Metadata = { title: "Install" };

const STEPS = [
  "Copy the script tag below.",
  <>
    Paste it before the <code>{"</body>"}</code> tag on your site.
  </>,
  "Reload your site and look for the chat button.",
];

export default async function Page({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const parsed = IdParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const project = await getOwnedProject(parsed.data.id);
  if (!project) notFound();

  let snippet: string;
  try {
    snippet = buildInstallSnippet(await getAppUrl(), project.public_key);
  } catch {
    return (
      <>
        <PageHeader title="Install" description="Add the widget to your website." />
        <ErrorState title="Can't build your script tag" description="Reload the page. If it keeps happening, contact support." />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Install" description="Add the widget to your website." />
      <ol className="mb-6 list-decimal space-y-2 pl-5 text-sm text-fg">
        {STEPS.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <CopySnippet snippet={snippet} />
    </>
  );
}
