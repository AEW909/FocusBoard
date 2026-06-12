import { FocusBoard } from "@/components/focus/focus-board";
import { FocusPullToRefresh } from "@/components/focus/focus-pull-to-refresh";
import { getFocusBoardData } from "@/lib/focus-board/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const board = await getFocusBoardData();

  return (
    <main className="shell focus-public-page focus-public-page-neon">
      <FocusPullToRefresh label="Release to refresh board" />
      <FocusBoard board={board} initialView="week" />
    </main>
  );
}
