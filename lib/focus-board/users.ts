import { createFocusBoardAdminClient } from "@/lib/focus-board/db";
import { listAllAuthUsers, type AuthUserSummary } from "@/lib/focus-board/memberships";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

type FocusMembershipRow = {
  id: string;
  user_id: string;
  client_id: string;
  role: FocusManagedUserMembership["role"];
  is_active: boolean;
  content_lab_access: boolean;
};

type FocusPlatformUserRow = {
  user_id: string;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

type ClientRow = {
  id: string;
  display_name: string;
};

type BoardRow = {
  client_id: string;
  board_slug: string;
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

function toManagedUserSummary(
  authUser: AuthUserSummary,
  profile: ProfileRow | undefined,
  isPlatformOwner: boolean,
  memberships: FocusManagedUserMembership[],
): FocusManagedUserSummary {
  return {
    userId: authUser.id,
    email: profile?.email ?? authUser.email,
    fullName: profile?.full_name ?? authUser.fullName ?? null,
    createdAt: authUser.createdAt,
    isPlatformOwner,
    memberships,
  };
}

export async function getManagedFocusUsers() {
  const [authUsers, membershipsResult, platformUsersResult] = await Promise.all([
    listAllAuthUsers(),
    createFocusBoardAdminClient()
      .from("client_memberships")
      .select("id, user_id, client_id, role, is_active, content_lab_access")
      .order("is_active", { ascending: false }),
    createFocusBoardAdminClient()
      .from("platform_users")
      .select("user_id")
      .eq("role", "platform_owner")
      .eq("is_active", true),
  ]);

  if (membershipsResult.error) {
    throw new Error(`Failed to load FocusBoard memberships: ${membershipsResult.error.message}`);
  }

  if (platformUsersResult.error) {
    throw new Error(`Failed to load platform owners: ${platformUsersResult.error.message}`);
  }

  if (authUsers.length === 0) {
    return [] satisfies FocusManagedUserSummary[];
  }

  const authUserIds = authUsers.map((user) => user.id);
  const memberships = (membershipsResult.data ?? []) as FocusMembershipRow[];
  const platformUsers = (platformUsersResult.data ?? []) as FocusPlatformUserRow[];

  const clientIds = [...new Set(memberships.map((membership) => membership.client_id))];
  const admin = createSupabaseAdminClient();
  const [{ data: profiles, error: profilesError }, { data: clients, error: clientsError }, { data: boards, error: boardsError }] =
    await Promise.all([
      admin.from("profiles").select("id, email, full_name").in("id", authUserIds),
      clientIds.length > 0
        ? createFocusBoardAdminClient().from("clients").select("id, display_name").in("id", clientIds)
        : Promise.resolve({ data: [], error: null }),
      clientIds.length > 0
        ? createFocusBoardAdminClient().from("focus_board_settings").select("client_id, board_slug").in("client_id", clientIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (profilesError) {
    throw new Error(`Failed to load shared profiles: ${profilesError.message}`);
  }

  if (clientsError) {
    throw new Error(`Failed to load FocusBoard clients: ${clientsError.message}`);
  }

  if (boardsError) {
    throw new Error(`Failed to load FocusBoard boards: ${boardsError.message}`);
  }

  const profilesById = new Map(((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
  const clientsById = new Map(((clients ?? []) as ClientRow[]).map((client) => [client.id, client]));
  const boardsByClientId = new Map(((boards ?? []) as BoardRow[]).map((board) => [board.client_id, board]));
  const platformOwnerIds = new Set(platformUsers.map((entry) => entry.user_id));
  const membershipsByUserId = new Map<string, FocusManagedUserMembership[]>();

  for (const membership of memberships) {
    const client = clientsById.get(membership.client_id);
    const board = boardsByClientId.get(membership.client_id);

    if (!client || !board) {
      continue;
    }

    const current = membershipsByUserId.get(membership.user_id) ?? [];
    current.push({
      membershipId: membership.id,
      clientId: membership.client_id,
      displayName: client.display_name,
      boardSlug: board.board_slug,
      role: membership.role,
      isActive: membership.is_active,
      contentLabAccess: membership.content_lab_access,
    });
    membershipsByUserId.set(membership.user_id, current);
  }

  return authUsers
    .map((authUser) =>
      toManagedUserSummary(
        authUser,
        profilesById.get(authUser.id),
        platformOwnerIds.has(authUser.id),
        (membershipsByUserId.get(authUser.id) ?? []).sort(compareMemberships),
      ),
    )
    .sort(compareUsers);
}
