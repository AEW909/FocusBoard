import { NextResponse, type NextRequest } from "next/server";
import { getCurrentFocusBoardAccess, getManagedFocusClients } from "@/lib/focus-board/access";
import { canViewDisplayGroup } from "@/lib/focus-board/display-auth";
import { getDisplayGroupClients, normaliseDisplayGroup } from "@/lib/focus-board/display-tokens";
import { getDisplayVersion } from "@/lib/focus-board/display-version";

export const dynamic = "force-dynamic";

function denied() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const group = normaliseDisplayGroup(request.nextUrl.searchParams.get("group"));
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];

  let boardKeys: string[];

  if (group) {
    if (!(await canViewDisplayGroup(group, bearer))) {
      return denied();
    }

    boardKeys = (await getDisplayGroupClients(group)).map((client) => client.boardKey);
  } else {
    // No group: the all-boards owner preview at /display.
    const current = await getCurrentFocusBoardAccess();

    if (!current?.access.isPlatformOwner) {
      return denied();
    }

    const clients = await getManagedFocusClients();
    boardKeys = clients.filter((client) => client.status === "active").map((client) => client.boardKey);
  }

  const version = await getDisplayVersion(boardKeys);

  return NextResponse.json({ version }, { headers: { "Cache-Control": "no-store" } });
}
