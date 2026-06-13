import { notFound } from "next/navigation";
import { ProtectedSessionBar } from "@/components/auth/protected-session-bar";
import { FocusContentLab } from "@/components/focus/focus-content-lab";
import { requireFocusContentLabAccessByClientId } from "@/lib/focus-board/access";
import { getFocusBoardRuntimeConfigByClientId } from "@/lib/focus-board/runtime";

export const dynamic = "force-dynamic";

type FocusClientContentPageProps = {
  params: Promise<{ clientId: string }>;
};

export default async function FocusClientContentPage({
  params,
}: FocusClientContentPageProps) {
  const { clientId } = await params;
  const { access, client } = await requireFocusContentLabAccessByClientId(
    clientId,
    `/clients/${clientId}/content`,
  );
  const runtime = await getFocusBoardRuntimeConfigByClientId(clientId);

  if (!runtime) {
    notFound();
  }

  const backHref = access.isPlatformOwner ? "/clients" : `/board/${runtime.settings.boardSlug}`;
  const backLabel = access.isPlatformOwner ? "Back to clients" : "Back to board";

  return (
    <>
      <ProtectedSessionBar
        backHref={backHref}
        backLabel={backLabel}
        homeHref={`/board/${runtime.settings.boardSlug}`}
        title="Content Lab"
      />
      <FocusContentLab clientName={client.displayName} slug={runtime.settings.boardSlug} />
    </>
  );
}
