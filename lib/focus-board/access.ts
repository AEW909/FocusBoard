import { notFound, redirect } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  clients,
  clientMemberships,
  focusBoardSettings,
  platformUsers,
} from "@/lib/db/schema";
import { getSessionUser, requireUser } from "@/lib/auth/session";
import type { FocusThemePreset } from "@/lib/focus-board/config";

export type FocusClientAccess = {
  clientId: string;
  clientKey: string;
  displayName: string;
  status: "active" | "inactive";
  contentLabEnabled: boolean;
  businessStatsEnabled: boolean;
  canUseContentLab: boolean;
  membershipRole: "client_admin" | "client_user";
  boardKey: string;
  boardSlug: string;
  adminSlug: string;
  themePreset: FocusThemePreset;
};

export type FocusBoardAccess = {
  isPlatformOwner: boolean;
  clients: FocusClientAccess[];
};

export type FocusManagedClient = Omit<FocusClientAccess, "membershipRole">;

type FocusClientLookup = {
  client?: FocusManagedClient;
  access: FocusBoardAccess;
};

export async function getFocusBoardAccessForUser(userId: string): Promise<FocusBoardAccess> {
  const [platformRows, membershipRows] = await Promise.all([
    db
      .select({ userId: platformUsers.userId })
      .from(platformUsers)
      .where(
        and(
          eq(platformUsers.userId, userId),
          eq(platformUsers.role, "platform_owner"),
          eq(platformUsers.isActive, true),
        ),
      )
      .limit(1),
    db
      .select({
        clientId: clientMemberships.clientId,
        role: clientMemberships.role,
        contentLabAccess: clientMemberships.contentLabAccess,
      })
      .from(clientMemberships)
      .where(
        and(eq(clientMemberships.userId, userId), eq(clientMemberships.isActive, true)),
      ),
  ]);

  const isPlatformOwner = platformRows.length > 0;
  const memberships = membershipRows;

  if (memberships.length === 0) {
    return { isPlatformOwner, clients: [] };
  }

  const clientIds = memberships.map((m) => m.clientId);
  const [clientRows, boardRows] = await Promise.all([
    db
      .select({
        id: clients.id,
        clientKey: clients.clientKey,
        displayName: clients.displayName,
        status: clients.status,
        contentLabEnabled: clients.contentLabEnabled,
        businessStatsEnabled: clients.businessStatsEnabled,
      })
      .from(clients)
      .where(inArray(clients.id, clientIds)),
    db
      .select({
        clientId: focusBoardSettings.clientId,
        boardKey: focusBoardSettings.boardKey,
        boardSlug: focusBoardSettings.boardSlug,
        adminSlug: focusBoardSettings.adminSlug,
        themePreset: focusBoardSettings.themePreset,
      })
      .from(focusBoardSettings)
      .where(inArray(focusBoardSettings.clientId, clientIds)),
  ]);

  const clientsById = new Map(clientRows.map((c) => [c.id, c]));
  const boardsByClientId = new Map(boardRows.map((b) => [b.clientId, b]));

  return {
    isPlatformOwner,
    clients: memberships.flatMap((membership) => {
      const client = clientsById.get(membership.clientId);
      const board = boardsByClientId.get(membership.clientId);

      if (!client || !board || client.status !== "active") {
        return [];
      }

      return [
        {
          clientId: client.id,
          clientKey: client.clientKey,
          displayName: client.displayName,
          status: client.status as FocusClientAccess["status"],
          contentLabEnabled: client.contentLabEnabled,
          businessStatsEnabled: client.businessStatsEnabled,
          canUseContentLab: membership.contentLabAccess,
          membershipRole: membership.role as FocusClientAccess["membershipRole"],
          boardKey: board.boardKey,
          boardSlug: board.boardSlug,
          adminSlug: board.adminSlug,
          themePreset: board.themePreset as FocusThemePreset,
        },
      ];
    }),
  };
}

export async function getCurrentFocusBoardAccess() {
  const user = await getSessionUser();

  if (!user) {
    return null;
  }

  return {
    user,
    access: await getFocusBoardAccessForUser(user.id),
  };
}

export function getFocusBoardHomePath(access: FocusBoardAccess) {
  if (access.isPlatformOwner) {
    return "/clients";
  }

  if (access.clients.length === 1) {
    return `/board/${access.clients[0].boardSlug}`;
  }

  if (access.clients.length > 1) {
    return "/boards";
  }

  return "/no-board";
}

export async function requireFocusPlatformOwner(nextPath?: string) {
  const user = await requireUser(nextPath);
  const access = await getFocusBoardAccessForUser(user.id);

  if (!access.isPlatformOwner) {
    redirect("/");
  }

  return { user, access };
}

export async function getManagedFocusClients(): Promise<FocusManagedClient[]> {
  const rows = await db
    .select({
      id: clients.id,
      clientKey: clients.clientKey,
      displayName: clients.displayName,
      status: clients.status,
      contentLabEnabled: clients.contentLabEnabled,
      businessStatsEnabled: clients.businessStatsEnabled,
      boardKey: focusBoardSettings.boardKey,
      boardSlug: focusBoardSettings.boardSlug,
      adminSlug: focusBoardSettings.adminSlug,
      themePreset: focusBoardSettings.themePreset,
    })
    .from(clients)
    .innerJoin(focusBoardSettings, eq(focusBoardSettings.clientId, clients.id))
    .orderBy(asc(clients.displayName));

  return rows.map((row) => ({
    clientId: row.id,
    clientKey: row.clientKey,
    displayName: row.displayName,
    status: row.status as FocusClientAccess["status"],
    contentLabEnabled: row.contentLabEnabled,
    businessStatsEnabled: row.businessStatsEnabled,
    canUseContentLab: row.contentLabEnabled,
    boardKey: row.boardKey,
    boardSlug: row.boardSlug,
    adminSlug: row.adminSlug,
    themePreset: row.themePreset as FocusThemePreset,
  }));
}

async function findManagedClientBy(
  selector: "clientId" | "boardSlug" | "adminSlug",
  value: string,
): Promise<FocusManagedClient | null> {
  const condition =
    selector === "clientId"
      ? eq(focusBoardSettings.clientId, value)
      : selector === "boardSlug"
        ? eq(focusBoardSettings.boardSlug, value)
        : eq(focusBoardSettings.adminSlug, value);

  const rows = await db
    .select({
      boardKey: focusBoardSettings.boardKey,
      boardSlug: focusBoardSettings.boardSlug,
      adminSlug: focusBoardSettings.adminSlug,
      themePreset: focusBoardSettings.themePreset,
      clientId: clients.id,
      clientKey: clients.clientKey,
      displayName: clients.displayName,
      status: clients.status,
      contentLabEnabled: clients.contentLabEnabled,
      businessStatsEnabled: clients.businessStatsEnabled,
    })
    .from(focusBoardSettings)
    .innerJoin(clients, eq(focusBoardSettings.clientId, clients.id))
    .where(condition)
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    clientId: row.clientId,
    clientKey: row.clientKey,
    displayName: row.displayName,
    status: row.status as FocusClientAccess["status"],
    contentLabEnabled: row.contentLabEnabled,
    businessStatsEnabled: row.businessStatsEnabled,
    canUseContentLab: row.contentLabEnabled,
    boardKey: row.boardKey,
    boardSlug: row.boardSlug,
    adminSlug: row.adminSlug,
    themePreset: row.themePreset as FocusThemePreset,
  };
}

async function getClientLookupForUser(
  userId: string,
  selector: "clientId" | "boardSlug" | "adminSlug",
  value: string,
): Promise<FocusClientLookup> {
  const access = await getFocusBoardAccessForUser(userId);

  const membershipClient =
    selector === "clientId"
      ? access.clients.find((c) => c.clientId === value)
      : selector === "boardSlug"
        ? access.clients.find((c) => c.boardSlug === value)
        : access.clients.find((c) => c.adminSlug === value);

  if (membershipClient) {
    return { access, client: membershipClient };
  }

  if (!access.isPlatformOwner) {
    return { access };
  }

  const managedClient = await findManagedClientBy(selector, value);
  return { access, client: managedClient ?? undefined };
}

export async function requireFocusBoardAccessBySlug(boardSlug: string, nextPath?: string) {
  const user = await requireUser(nextPath ?? `/board/${boardSlug}`);
  const lookup = await getClientLookupForUser(user.id, "boardSlug", boardSlug);

  if (!lookup.client || lookup.client.status !== "active") {
    notFound();
  }

  return { user, access: lookup.access, client: lookup.client };
}

export async function requireFocusContentLabAccessBySlug(boardSlug: string, nextPath?: string) {
  const result = await requireFocusBoardAccessBySlug(boardSlug, nextPath ?? `/focus-content/${boardSlug}`);

  if (!result.client.contentLabEnabled || !result.client.canUseContentLab) {
    notFound();
  }

  return result;
}

export async function requireFocusContentLabAccessByClientId(clientId: string, nextPath?: string) {
  const user = await requireUser(nextPath ?? `/clients/${clientId}/content`);
  const lookup = await getClientLookupForUser(user.id, "clientId", clientId);

  if (!lookup.client || lookup.client.status !== "active") {
    notFound();
  }

  if (!lookup.access.isPlatformOwner && !lookup.client.canUseContentLab) {
    notFound();
  }

  if (!lookup.client.contentLabEnabled) {
    notFound();
  }

  return { user, access: lookup.access, client: lookup.client };
}

export async function requireFocusBusinessStatsAccessByClientId(clientId: string, nextPath?: string) {
  const user = await requireUser(nextPath ?? `/clients/${clientId}/business`);
  const lookup = await getClientLookupForUser(user.id, "clientId", clientId);

  if (!lookup.client || lookup.client.status !== "active") {
    notFound();
  }

  if (!lookup.client.businessStatsEnabled) {
    notFound();
  }

  return { user, access: lookup.access, client: lookup.client };
}

export async function requireManagedFocusClientById(clientId: string, nextPath?: string) {
  const user = await requireUser(nextPath ?? `/clients/${clientId}/manage`);
  const lookup = await getClientLookupForUser(user.id, "clientId", clientId);

  if (!lookup.access.isPlatformOwner) {
    redirect("/");
  }

  if (!lookup.client) {
    notFound();
  }

  return { user, access: lookup.access, client: lookup.client };
}

export async function requireManagedFocusClientByAdminSlug(adminSlug: string, nextPath?: string) {
  const user = await requireUser(nextPath ?? `/focus-control/${adminSlug}`);
  const lookup = await getClientLookupForUser(user.id, "adminSlug", adminSlug);

  if (!lookup.access.isPlatformOwner) {
    redirect("/");
  }

  if (!lookup.client) {
    notFound();
  }

  return { user, access: lookup.access, client: lookup.client };
}

export async function isCurrentUserFocusPlatformOwner() {
  const user = await getSessionUser();

  if (!user) {
    return false;
  }

  const access = await getFocusBoardAccessForUser(user.id);
  return access.isPlatformOwner;
}
