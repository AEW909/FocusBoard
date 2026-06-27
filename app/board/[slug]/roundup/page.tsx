import { notFound } from "next/navigation";
import { ProtectedSessionBar } from "@/components/auth/protected-session-bar";
import { FocusWeeklyRoundup } from "@/components/focus/focus-weekly-roundup";
import { getPreviousWeekKey } from "@/lib/focus-board/dates";
import { requireFocusBoardAccessBySlug } from "@/lib/focus-board/access";
import { getFocusWeeklyRoundupData } from "@/lib/focus-board/roundup";

export const dynamic = "force-dynamic";

type RoundupPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string; week?: string }>;
};

export default async function WeeklyRoundupPage({ params, searchParams }: RoundupPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const { user, access, client } = await requireFocusBoardAccessBySlug(slug, `/board/${slug}/roundup`);
  const weekKey = query.week ?? getPreviousWeekKey();
  const isPreview = query.preview === "1";
  const roundup = await getFocusWeeklyRoundupData(client.boardKey, user.id, weekKey);

  if (!roundup || roundup.settings.boardSlug !== slug) {
    notFound();
  }

  const showSessionBar = access.isPlatformOwner;

  return (
    <>
      {showSessionBar ? (
        <ProtectedSessionBar
          backHref="/clients"
          backLabel="Back to clients"
          homeHref={`/clients/${client.clientId}/manage`}
          homeLabel="Edit board"
          title={`${client.displayName} roundup`}
        />
      ) : null}
      <main className={`shell focus-public-page focus-public-page-neon focus-theme-${roundup.settings.themePreset}`}>
        <FocusWeeklyRoundup isPreview={isPreview} roundup={roundup} />
      </main>
    </>
  );
}
