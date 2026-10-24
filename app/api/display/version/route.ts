import { NextResponse } from "next/server";
import { getCurrentFocusBoardAccess, getManagedFocusClients } from "@/lib/focus-board/access";
import { getDisplayVersion } from "@/lib/focus-board/display-version";

export const dynamic = "force-dynamic";

export async function GET() {
  const current = await getCurrentFocusBoardAccess();

  if (!current?.access.isPlatformOwner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clients = await getManagedFocusClients();
  const version = await getDisplayVersion(
    clients.filter((client) => client.status === "active").map((client) => client.boardKey),
  );

  return NextResponse.json({ version }, { headers: { "Cache-Control": "no-store" } });
}
