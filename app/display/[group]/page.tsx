import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FamilyDisplay } from "@/components/display/family-display";
import { canViewDisplayGroup } from "@/lib/focus-board/display-auth";
import { getDisplayGroupClients, normaliseDisplayGroup } from "@/lib/focus-board/display-tokens";
import { getDisplayVersion } from "@/lib/focus-board/display-version";
import { getFocusBoardData } from "@/lib/focus-board/queries";

export const dynamic = "force-dynamic";

// The token lives in the URL, so keep it out of Referer headers and search indexes.
export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

type DisplayGroupPageProps = {
  params: Promise<{ group: string }>;
  searchParams: Promise<{ dt?: string }>;
};

export default async function DisplayGroupPage({ params, searchParams }: DisplayGroupPageProps) {
  const { group: rawGroup } = await params;
  const { dt } = await searchParams;
  const group = normaliseDisplayGroup(rawGroup);

  // Same non-disclosing 404 for a bad token, a missing token and an unknown group.
  if (!(await canViewDisplayGroup(group, dt))) {
    notFound();
  }

  const clients = await getDisplayGroupClients(group);

  if (clients.length === 0) {
    notFound();
  }

  // Read the version before the data so a change landing in between is caught on the next check.
  const version = await getDisplayVersion(clients.map((client) => client.boardKey));
  const boards = await Promise.all(clients.map((client) => getFocusBoardData(client.boardKey)));

  return (
    <FamilyDisplay
      boards={clients.map((client, i) => ({ client, board: boards[i]! }))}
      group={group}
      token={dt}
      version={version}
    />
  );
}
