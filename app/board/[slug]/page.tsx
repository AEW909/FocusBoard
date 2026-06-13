import { notFound } from "next/navigation";
import { FocusBoard } from "@/components/focus/focus-board";
import { ProtectedSessionBar } from "@/components/auth/protected-session-bar";
import { FocusPullToRefresh } from "@/components/focus/focus-pull-to-refresh";
import { getFocusBoardData } from "@/lib/focus-board/queries";
import { requireFocusBoardAccessBySlug } from "@/lib/focus-board/access";

export const dynamic = "force-dynamic";

type BoardPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ history?: string; month?: string; week?: string; view?: string }>;
};

export default async function BoardPage({ params, searchParams }: BoardPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const { access, client } = await requireFocusBoardAccessBySlug(slug, `/board/${slug}`);
  const board = await getFocusBoardData(client.boardKey, {
    history: query.history,
    month: query.month,
    week: query.week,
  });

  if (board.settings.boardSlug !== slug) {
    notFound();
  }

  const initialView = query.view === "month" ? "month" : "week";
  const backHref = access.isPlatformOwner ? "/clients" : access.clients.length > 1 ? "/boards" : undefined;
  const backLabel = access.isPlatformOwner ? "Back to clients" : "Back to boards";

  return (
    <>
      <ProtectedSessionBar
        backHref={backHref}
        backLabel={backHref ? backLabel : undefined}
        title={client.displayName}
      />
      <main className="shell focus-public-page focus-public-page-neon">
        <FocusPullToRefresh label="Release to refresh board" />
        <FocusBoard
          board={board}
          contentLabEnabled={client.contentLabEnabled && client.canUseContentLab}
          initialView={initialView}
        />
      </main>
    </>
  );
}
