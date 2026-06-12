import { notFound } from "next/navigation";
import { FocusBoard } from "@/components/focus/focus-board";
import { FocusPullToRefresh } from "@/components/focus/focus-pull-to-refresh";
import { FOCUS_BOARD_SLUG } from "@/lib/focus-board/config";
import { getFocusBoardData } from "@/lib/focus-board/queries";
import { getFocusBoardRuntimeConfigByPublicSlug } from "@/lib/focus-board/runtime";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const config = await getFocusBoardRuntimeConfigByPublicSlug(FOCUS_BOARD_SLUG);

  if (!config) {
    notFound();
  }

  const board = await getFocusBoardData(config.settings.boardKey);

  return (
    <main className="shell focus-public-page focus-public-page-neon">
      <FocusPullToRefresh label="Release to refresh board" />
      <FocusBoard board={board} initialView="week" />
    </main>
  );
}
