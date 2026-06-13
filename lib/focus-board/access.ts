import { notFound, redirect } from "next/navigation";
import { getSessionUser, requireUser } from "@/lib/auth/session";
import { createFocusBoardAdminClient } from "@/lib/focus-board/db";

export type FocusClientAccess = {
  clientId: string;
  clientKey: string;
  displayName: string;
  status: "active" | "inactive";
  contentLabEnabled: boolean;
  canUseContentLab: boolean;
  membershipRole: "client_admin" | "client_user";
  boardKey: string;
  boardSlug: string;
  adminSlug: string;
};

export type FocusBoardAccess = {
  isPlatformOwner: boolean;
  clients: FocusClientAccess[];
};

export type FocusManagedClient = Omit<FocusClientAccess, "membershipRole">;

type MembershipRow = {
  client_id: string;
  role: FocusClientAccess["membershipRole"];
  content_lab_access: boolean;
};

type ClientRow = {
  id: string;
  client_key: string;
  display_name: string;
  status: FocusClientAccess["status"];
  content_lab_enabled: boolean;
};

type BoardRow = {
  client_id: string;
  board_key: string;
  board_slug: string;
  admin_slug: string;
};

type FocusClientLookup = {
  client?: FocusManagedClient;
  access: FocusBoardAccess;
};

export async function getFocusBoardAccessForUser(userId: string): Promise<FocusBoardAccess> {
  const admin = createFocusBoardAdminClient();
  const [platformResult, membershipResult] = await Promise.all([
    admin
      .from("platform_users")
      .select("user_id")
      .eq("user_id", userId)
      .eq("role", "platform_owner")
      .eq("is_active", true)
      .maybeSingle(),
    admin
      .from("client_memberships")
      .select("client_id, role, content_lab_access")
      .eq("user_id", userId)
      .eq("is_active", true),
  ]);

  if (platformResult.error) {
    throw new Error(`Failed to load FocusBoard platform access: ${platformResult.error.message}`);
  }

  if (membershipResult.error) {
    throw new Error(`Failed to load FocusBoard memberships: ${membershipResult.error.message}`);
  }

  const memberships = (membershipResult.data ?? []) as MembershipRow[];

  if (memberships.length === 0) {
    return {
      isPlatformOwner: Boolean(platformResult.data),
      clients: [],
    };
  }

  const clientIds = memberships.map((membership) => membership.client_id);
  const [clientResult, boardResult] = await Promise.all([
    admin
      .from("clients")
      .select("id, client_key, display_name, status, content_lab_enabled")
      .in("id", clientIds),
    admin
      .from("focus_board_settings")
      .select("client_id, board_key, board_slug, admin_slug")
      .in("client_id", clientIds),
  ]);

  if (clientResult.error) {
    throw new Error(`Failed to load FocusBoard clients: ${clientResult.error.message}`);
  }

  if (boardResult.error) {
    throw new Error(`Failed to load client boards: ${boardResult.error.message}`);
  }

  const clientsById = new Map(
    ((clientResult.data ?? []) as ClientRow[]).map((client) => [client.id, client]),
  );
  const boardsByClientId = new Map(
    ((boardResult.data ?? []) as BoardRow[]).map((board) => [board.client_id, board]),
  );

  return {
    isPlatformOwner: Boolean(platformResult.data),
    clients: memberships.flatMap((membership) => {
      const client = clientsById.get(membership.client_id);
      const board = boardsByClientId.get(membership.client_id);

      if (!client || !board || client.status !== "active") {
        return [];
      }

      return [{
        clientId: client.id,
        clientKey: client.client_key,
        displayName: client.display_name,
        status: client.status,
        contentLabEnabled: client.content_lab_enabled,
        canUseContentLab: membership.content_lab_access,
        membershipRole: membership.role,
        boardKey: board.board_key,
        boardSlug: board.board_slug,
        adminSlug: board.admin_slug,
      }];
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

  return null;
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
  const admin = createFocusBoardAdminClient();
  const [clientResult, boardResult] = await Promise.all([
    admin
      .from("clients")
      .select("id, client_key, display_name, status, content_lab_enabled")
      .order("display_name", { ascending: true }),
    admin
      .from("focus_board_settings")
      .select("client_id, board_key, board_slug, admin_slug"),
  ]);

  if (clientResult.error) {
    throw new Error(`Failed to load FocusBoard clients: ${clientResult.error.message}`);
  }

  if (boardResult.error) {
    throw new Error(`Failed to load client boards: ${boardResult.error.message}`);
  }

  const boardsByClientId = new Map(
    ((boardResult.data ?? []) as BoardRow[]).map((board) => [board.client_id, board]),
  );

  return ((clientResult.data ?? []) as ClientRow[]).flatMap((client) => {
    const board = boardsByClientId.get(client.id);

    if (!board) {
      return [];
    }

    return [{
      clientId: client.id,
      clientKey: client.client_key,
      displayName: client.display_name,
      status: client.status,
      contentLabEnabled: client.content_lab_enabled,
      canUseContentLab: client.content_lab_enabled,
      boardKey: board.board_key,
      boardSlug: board.board_slug,
      adminSlug: board.admin_slug,
    }];
  });
}

async function findManagedClientBy(
  selector: "id" | "board_slug" | "admin_slug",
  value: string,
): Promise<FocusManagedClient | null> {
  const admin = createFocusBoardAdminClient();
  const query = admin
    .from("focus_board_settings")
    .select(
      "client_id, board_key, board_slug, admin_slug, clients!inner(id, client_key, display_name, status, content_lab_enabled)",
    )
    .eq(selector, value)
    .maybeSingle();

  const { data, error } = await query;

  if (error || !data) {
    return null;
  }

  const client = Array.isArray(data.clients) ? data.clients[0] : data.clients;

  if (!client) {
    return null;
  }

  return {
    clientId: client.id,
    clientKey: client.client_key,
    displayName: client.display_name,
    status: client.status,
    contentLabEnabled: client.content_lab_enabled,
    canUseContentLab: client.content_lab_enabled,
    boardKey: data.board_key,
    boardSlug: data.board_slug,
    adminSlug: data.admin_slug,
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
      ? access.clients.find((client) => client.clientId === value)
      : selector === "boardSlug"
        ? access.clients.find((client) => client.boardSlug === value)
        : access.clients.find((client) => client.adminSlug === value);

  if (membershipClient) {
    return {
      access,
      client: membershipClient,
    };
  }

  if (!access.isPlatformOwner) {
    return { access };
  }

  const managedClient =
    selector === "clientId"
      ? await findManagedClientBy("id", value)
      : selector === "boardSlug"
        ? await findManagedClientBy("board_slug", value)
        : await findManagedClientBy("admin_slug", value);

  return {
    access,
    client: managedClient ?? undefined,
  };
}

export async function requireFocusBoardAccessBySlug(boardSlug: string, nextPath?: string) {
  const user = await requireUser(nextPath ?? `/board/${boardSlug}`);
  const lookup = await getClientLookupForUser(user.id, "boardSlug", boardSlug);

  if (!lookup.client || lookup.client.status !== "active") {
    notFound();
  }

  return {
    user,
    access: lookup.access,
    client: lookup.client,
  };
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

  return {
    user,
    access: lookup.access,
    client: lookup.client,
  };
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

  return {
    user,
    access: lookup.access,
    client: lookup.client,
  };
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

  return {
    user,
    access: lookup.access,
    client: lookup.client,
  };
}

export async function isCurrentUserFocusPlatformOwner() {
  const user = await getSessionUser();

  if (!user) {
    return false;
  }

  const access = await getFocusBoardAccessForUser(user.id);
  return access.isPlatformOwner;
}
