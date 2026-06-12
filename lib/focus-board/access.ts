import { redirect } from "next/navigation";
import { getSessionUser, requireUser } from "@/lib/auth/session";
import { createFocusBoardAdminClient } from "@/lib/focus-board/db";

export type FocusClientAccess = {
  clientId: string;
  clientKey: string;
  displayName: string;
  status: "active" | "inactive";
  contentLabEnabled: boolean;
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
      .select("client_id, role")
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
    return `/focus/${access.clients[0].boardSlug}`;
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
      boardKey: board.board_key,
      boardSlug: board.board_slug,
      adminSlug: board.admin_slug,
    }];
  });
}
