import type { Metadata } from "next";
import { Panel } from "../../components/embed/panel";
import { readEmbedParams } from "../../components/embed/params";
import { Unavailable } from "../../components/embed/unavailable";
import { getWidgetConfigByKey } from "../../lib/widget/config";

// The widget iframe. Not for search engines, and it always reflects the current config.
export const metadata: Metadata = {
  title: "Chat",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function EmbedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { key, origin } = readEmbedParams(await searchParams);
  if (!key) return <Unavailable />;

  let config;
  try {
    config = await getWidgetConfigByKey(key);
  } catch {
    return <Unavailable />;
  }
  if (!config) return <Unavailable />;

  return <Panel publicKey={key} parentOrigin={origin} config={config} />;
}
