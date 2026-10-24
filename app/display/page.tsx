import {
  getManagedFocusClients,
  requireFocusPlatformOwner,
} from "@/lib/focus-board/access";
import { getDisplayVersion } from "@/lib/focus-board/display-version";
import { getFocusBoardData } from "@/lib/focus-board/queries";
import { FamilyDisplay } from "@/components/display/family-display";

export const dynamic = "force-dynamic";

export default async function DisplayPage() {
  await requireFocusPlatformOwner("/display");
  const allClients = await getManagedFocusClients();
  const activeClients = allClients.filter((c) => c.status === "active");

  // Read the version before the data so a change landing in between is caught on the next check.
  const version = await getDisplayVersion(activeClients.map((client) => client.boardKey));
  const boards = await Promise.all(
    activeClients.map((client) => getFocusBoardData(client.boardKey)),
  );

  const displayBoards = activeClients.map((client, i) => ({
    client,
    board: boards[i]!,
  }));

  return <FamilyDisplay boards={displayBoards} version={version} />;
}
