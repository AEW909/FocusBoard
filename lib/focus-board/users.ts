import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  clientMemberships,
  clients,
  focusBoardSettings,
  platformUsers,
} from "@/lib/db/schema";
import { listAllAuthUsers, type AuthUserSummary } from "@/lib/focus-board/memberships";

export type FocusManagedUserMembership = {
  membershipId: string;
  clientId: string;
  displayName: string;
  boardSlug: string;
  role: "client_admin" | "client_user";
  isActive: boolean;
  contentLabAccess: boolean;
};

export type FocusManagedUserSummary = {
  userId: string;
  email: string;
  fullName: string | null;
  createdAt: string | null;
  isPlatformOwner: boolean;
  memberships: FocusManagedUserMembership[];
};

function compareUsers(a: FocusManagedUserSummary, b: FocusManagedUserSummary) {
  if (a.isPlatformOwner !== b.isPlatformOwner) {
    return a.isPlatformOwner ? -1 : 1;
  }

  const nameA = (a.fullName ?? a.email).toLowerCase();
  const nameB = (b.fullName ?? b.email).toLowerCase();
  return nameA.localeCompare(nameB);
}

function compareMemberships(a: FocusManagedUserMembership, b: FocusManagedUserMembership) {
  if (a.isActive !== b.isActive) {
    return a.isActive ? -1 : 1;
  }

  return a.displayName.localeCompare(b.displayName);
}

export async function getManagedFocusUsers() {
  const [authUsers, membershipRows, platformUserRows] = await Promise.all([
    listAllAuthUsers(),
    db
      .select({
        id: clientMemberships.id,
        userId: clientMemberships.userId,
        clientId: clientMemberships.clientId,
        role: clientMemberships.role,
        isActive: clientMemberships.isActive,
        contentLabAccess: clientMemberships.contentLabAccess,
      })
      .from(clientMemberships)
      .orderBy(desc(clientMemberships.isActive)),
    db
      .select({ userId: platformUsers.userId })
      .from(platformUsers)
      .where(and(eq(platformUsers.role, "platform_owner"), eq(platformUsers.isActive, true))),
  ]);

  if (authUsers.length === 0) {
    return [] satisfies FocusManagedUserSummary[];
  }

  const clientIds = [...new Set(membershipRows.map((m) => m.clientId))];
  const [clientRows, boardRows] = await Promise.all([
    clientIds.length > 0
      ? db.select({ id: clients.id, displayName: clients.displayName }).from(clients).where(inArray(clients.id, clientIds))
      : Promise.resolve([]),
    clientIds.length > 0
      ? db.select({ clientId: focusBoardSettings.clientId, boardSlug: focusBoardSettings.boardSlug }).from(focusBoardSettings).where(inArray(focusBoardSettings.clientId, clientIds))
      : Promise.resolve([]),
  ]);

  const clientsById = new Map(clientRows.map((c) => [c.id, c]));
  const boardsByClientId = new Map(boardRows.map((b) => [b.clientId, b]));
  const platformOwnerIds = new Set(platformUserRows.map((entry) => entry.userId));
  const membershipsByUserId = new Map<string, FocusManagedUserMembership[]>();

  for (const membership of membershipRows) {
    const client = clientsById.get(membership.clientId);
    const board = boardsByClientId.get(membership.clientId);

    if (!client || !board) {
      continue;
    }

    const current = membershipsByUserId.get(membership.userId) ?? [];
    current.push({
      membershipId: membership.id,
      clientId: membership.clientId,
      displayName: client.displayName,
      boardSlug: board.boardSlug,
      role: membership.role as FocusManagedUserMembership["role"],
      isActive: membership.isActive,
      contentLabAccess: membership.contentLabAccess,
    });
    membershipsByUserId.set(membership.userId, current);
  }

  return authUsers
    .map((authUser: AuthUserSummary): FocusManagedUserSummary => ({
      userId: authUser.id,
      email: authUser.email,
      fullName: authUser.fullName,
      createdAt: authUser.createdAt,
      isPlatformOwner: platformOwnerIds.has(authUser.id),
      memberships: (membershipsByUserId.get(authUser.id) ?? []).sort(compareMemberships),
    }))
    .sort(compareUsers);
}
