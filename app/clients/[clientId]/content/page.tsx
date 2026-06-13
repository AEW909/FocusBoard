import { notFound } from "next/navigation";
import { ProtectedSessionBar } from "@/components/auth/protected-session-bar";
import { FocusContentLab } from "@/components/focus/focus-content-lab";
import { requireFocusContentLabAccessByClientId } from "@/lib/focus-board/access";
import { getFocusContentProfile } from "@/lib/focus-board/content-profiles";
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
  const [runtime, contentProfile] = await Promise.all([
    getFocusBoardRuntimeConfigByClientId(clientId),
    getFocusContentProfile(clientId, client.displayName),
  ]);

  if (!runtime) {
    notFound();
  }

  const backHref = access.isPlatformOwner ? "/clients" : `/board/${runtime.settings.boardSlug}`;
  const backLabel = access.isPlatformOwner ? "Back to clients" : "Back to board";
  const switchHref = !access.isPlatformOwner && access.clients.length > 1 ? "/boards" : undefined;

  return (
    <>
      <ProtectedSessionBar
        backHref={backHref}
        backLabel={backLabel}
        homeHref={`/board/${runtime.settings.boardSlug}`}
        switchHref={switchHref}
        title="Content Lab"
      />
      <FocusContentLab clientName={contentProfile.businessName} slug={runtime.settings.boardSlug} />
    </>
  );
}
