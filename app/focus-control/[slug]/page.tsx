import { redirect } from "next/navigation";
import { getFocusBoardRuntimeConfigByAdminSlug } from "@/lib/focus-board/runtime";
import { requireManagedFocusClientByAdminSlug } from "@/lib/focus-board/access";

export const dynamic = "force-dynamic";

type LegacyFocusControlPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function LegacyFocusControlPage({ params }: LegacyFocusControlPageProps) {
  const { slug } = await params;
  const { client } = await requireManagedFocusClientByAdminSlug(slug, `/focus-control/${slug}`);
  const runtime = await getFocusBoardRuntimeConfigByAdminSlug(slug);

  if (!runtime) {
    redirect("/clients");
  }

  redirect(`/clients/${client.clientId}/manage`);
}
