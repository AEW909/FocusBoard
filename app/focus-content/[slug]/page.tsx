import { notFound, redirect } from "next/navigation";
import { getFocusBoardRuntimeConfigByPublicSlug } from "@/lib/focus-board/runtime";

export const dynamic = "force-dynamic";

type LegacyFocusContentPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function LegacyFocusContentPage({
  params,
}: LegacyFocusContentPageProps) {
  const { slug } = await params;
  const runtime = await getFocusBoardRuntimeConfigByPublicSlug(slug);

  if (!runtime?.settings.clientId) {
    notFound();
  }

  redirect(`/clients/${runtime.settings.clientId}/content`);
}
