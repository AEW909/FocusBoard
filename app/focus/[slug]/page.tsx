import { notFound } from "next/navigation";
import { FocusBoard } from "@/components/focus/focus-board";
import { FocusPullToRefresh } from "@/components/focus/focus-pull-to-refresh";
import { getFocusBoardRuntimeConfigByPublicSlug } from "@/lib/focus-board/runtime";
import { getFocusBoardData } from "@/lib/focus-board/queries";

export const dynamic = "force-dynamic";

type FocusBoardPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ history?: string; month?: string; week?: string; view?: string }>;
};

export default async function FocusBoardPage({ params, searchParams }: FocusBoardPageProps) {
  const { slug } = await params;
  const query = await searchParams;

  const config = await getFocusBoardRuntimeConfigByPublicSlug(slug);

  if (!config) {
    notFound();
  }

  const board = await getFocusBoardData(config.settings.boardKey, {
    history: query.history,
    month: query.month,
    week: query.week,
  });
  const initialView = query.view === "month" ? "month" : "week";

  return (
    <main className="shell focus-public-page focus-public-page-neon">
      <FocusPullToRefresh label="Release to refresh board" />
      <FocusBoard board={board} initialView={initialView} />
    </main>
  );
}
