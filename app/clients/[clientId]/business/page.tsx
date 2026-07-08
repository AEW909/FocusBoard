import { notFound } from "next/navigation";
import { ProtectedSessionBar } from "@/components/auth/protected-session-bar";
import { FocusBusinessStats } from "@/components/focus/focus-business-stats";
import { requireFocusBusinessStatsAccessByClientId } from "@/lib/focus-board/access";
import { getBusinessStatsData } from "@/lib/focus-board/business-stats";
import { getFocusBoardRuntimeConfigByClientId } from "@/lib/focus-board/runtime";

export const dynamic = "force-dynamic";

type FocusClientBusinessPageProps = {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{
    businessMessage?: string;
    businessError?: string;
    end?: string;
    start?: string;
    week?: string;
  }>;
};

export default async function FocusClientBusinessPage({
  params,
  searchParams,
}: FocusClientBusinessPageProps) {
  const { clientId } = await params;
  const query = await searchParams;
  const { access, client } = await requireFocusBusinessStatsAccessByClientId(
    clientId,
    `/clients/${clientId}/business`,
  );
  const [runtime, stats] = await Promise.all([
    getFocusBoardRuntimeConfigByClientId(clientId),
    getBusinessStatsData(clientId, {
      end: query.end,
      start: query.start,
      week: query.week,
    }),
  ]);

  if (!runtime) {
    notFound();
  }

  const backHref = access.isPlatformOwner ? "/clients" : `/board/${runtime.settings.boardSlug}`;
  const backLabel = access.isPlatformOwner ? "Back to clients" : "Back to board";
  const switchHref = !access.isPlatformOwner && access.clients.length > 1 ? "/boards" : undefined;
  const showSessionBar = access.isPlatformOwner;
  const visibleGroupIds = new Set(stats.visibleGroups.map((group) => group.id));
  const visibleCategories = stats.visibleCategories.filter(
    (category) => !category.groupId || visibleGroupIds.has(category.groupId),
  );

  return (
    <>
      {showSessionBar ? (
        <ProtectedSessionBar
          backHref={backHref}
          backLabel={backLabel}
          homeHref={`/board/${runtime.settings.boardSlug}`}
          switchHref={switchHref}
          title="Business Stats"
        />
      ) : null}
      <FocusBusinessStats
        backHref={!showSessionBar ? `/board/${runtime.settings.boardSlug}` : undefined}
        businessName={client.displayName}
        categories={visibleCategories}
        clientId={clientId}
        collectionWeek={stats.collectionWeek}
        currentWeek={stats.currentWeek}
        entries={stats.entries}
        groups={stats.visibleGroups}
        rangeEnd={stats.rangeEnd}
        rangeStart={stats.rangeStart}
        themePreset={runtime.settings.themePreset}
      />
    </>
  );
}
