import { notFound, redirect } from "next/navigation";
import { getFocusBoardRuntimeConfigByPublicSlug } from "@/lib/focus-board/runtime";

export const dynamic = "force-dynamic";

type LegacyFocusBoardPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ history?: string; month?: string; week?: string; view?: string }>;
};

export default async function LegacyFocusBoardPage({
  params,
  searchParams,
}: LegacyFocusBoardPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const config = await getFocusBoardRuntimeConfigByPublicSlug(slug);

  if (!config) {
    notFound();
  }

  const nextParams = new URLSearchParams();

  if (query.history) {
    nextParams.set("history", query.history);
  }

  if (query.month) {
    nextParams.set("month", query.month);
  }

  if (query.week) {
    nextParams.set("week", query.week);
  }

  if (query.view) {
    nextParams.set("view", query.view);
  }

  const suffix = nextParams.toString();
  redirect(suffix ? `/board/${config.settings.boardSlug}?${suffix}` : `/board/${config.settings.boardSlug}`);
}
