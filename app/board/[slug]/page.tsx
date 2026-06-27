import { notFound, redirect } from "next/navigation";
import { FocusBoard } from "@/components/focus/focus-board";
import { ProtectedSessionBar } from "@/components/auth/protected-session-bar";
import { FocusPullToRefresh } from "@/components/focus/focus-pull-to-refresh";
import { getFocusBoardData } from "@/lib/focus-board/queries";
import { requireFocusBoardAccessBySlug } from "@/lib/focus-board/access";
import { getPendingFocusWeeklyRoundup } from "@/lib/focus-board/roundup";

export const dynamic = "force-dynamic";

type BoardPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ history?: string; month?: string; week?: string; view?: string }>;
};

export default async function BoardPage({ params, searchParams }: BoardPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const { user, access, client } = await requireFocusBoardAccessBySlug(slug, `/board/${slug}`);
  const pendingRoundup = await getPendingFocusWeeklyRoundup(user.id, client.boardKey);

  if (pendingRoundup) {
    redirect(`/board/${client.boardSlug}/roundup?week=${pendingRoundup.weekKey}`);
  }

  const board = await getFocusBoardData(client.boardKey, {
    history: query.history,
    month: query.month,
    week: query.week,
  });

  if (board.settings.boardSlug !== slug) {
    notFound();
  }

  const initialView = query.view === "month" ? "month" : "week";
  const backHref = access.isPlatformOwner ? "/clients" : undefined;
  const backLabel = "Back to clients";
  const homeHref = access.isPlatformOwner ? `/clients/${client.clientId}/manage` : undefined;
  const homeLabel = "Edit board";
  const switchHref = !access.isPlatformOwner && access.clients.length > 1 ? "/boards" : undefined;
  const showSessionBar = access.isPlatformOwner;

  return (
    <>
      {showSessionBar ? (
        <ProtectedSessionBar
          backHref={backHref}
          backLabel={backHref ? backLabel : undefined}
          homeHref={homeHref}
          homeLabel={homeLabel}
          switchHref={switchHref}
          title={client.displayName}
        />
      ) : null}
      <main
        className={`shell focus-public-page focus-public-page-neon focus-theme-${board.settings.themePreset}`}
      >
        <FocusPullToRefresh label="Release to refresh board" />
        <FocusBoard
          board={board}
          contentLabEnabled={client.contentLabEnabled && client.canUseContentLab}
          initialView={initialView}
          showInlineSignOut={!showSessionBar}
        />
      </main>
    </>
  );
}
