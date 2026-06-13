import { createFocusBoardAdminClient } from "@/lib/focus-board/db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type FocusClientMembershipSummary = {
  membershipId: string;
  userId: string;
  email: string;
  fullName: string | null;
  role: "client_admin" | "client_user";
  isActive: boolean;
  contentLabAccess: boolean;
};

type FocusMembershipRow = {
  id: string;
  user_id: string;
  role: FocusClientMembershipSummary["role"];
  is_active: boolean;
  content_lab_access: boolean;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

type AuthUserSummary = {
  id: string;
  email: string;
  fullName: string | null;
};

function normaliseEmail(value: string) {
  return value.trim().toLowerCase();
}

async function listAllAuthUsers() {
  const admin = createSupabaseAdminClient();
  const users: AuthUserSummary[] = [];
  const perPage = 200;
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw new Error(`Failed to load auth users: ${error.message}`);
    }

    const batch = (data?.users ?? []).map((user) => ({
      id: user.id,
      email: user.email?.trim().toLowerCase() ?? "",
      fullName:
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : typeof user.user_metadata?.name === "string"
            ? user.user_metadata.name
            : null,
    }));

    users.push(...batch);

    if (batch.length < perPage) {
      break;
    }

    page += 1;
  }

  return users;
}

export async function findAuthUserByEmail(email: string) {
  const targetEmail = normaliseEmail(email);

  if (!targetEmail) {
    return null;
  }

  const users = await listAllAuthUsers();
  return users.find((user) => user.email === targetEmail) ?? null;
}

export async function getManagedFocusClientMemberships(clientId: string) {
  const focusAdmin = createFocusBoardAdminClient();
  const { data, error } = await focusAdmin
    .from("client_memberships")
    .select("id, user_id, role, is_active, content_lab_access")
    .eq("client_id", clientId)
    .order("is_active", { ascending: false })
    .order("role", { ascending: true });

  if (error) {
    throw new Error(`Failed to load client memberships: ${error.message}`);
  }

  const memberships = (data ?? []) as FocusMembershipRow[];

  if (memberships.length === 0) {
    return [] satisfies FocusClientMembershipSummary[];
  }

  const userIds = memberships.map((membership) => membership.user_id);
  const admin = createSupabaseAdminClient();
  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id, email, full_name")
    .in("id", userIds);

  if (profileError) {
    throw new Error(`Failed to load membership profiles: ${profileError.message}`);
  }

  const profilesById = new Map(
    ((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
  );
  const authUsers = await listAllAuthUsers();
  const authUsersById = new Map(authUsers.map((user) => [user.id, user]));

  return memberships.map((membership) => {
    const profile = profilesById.get(membership.user_id);
    const authUser = authUsersById.get(membership.user_id);

    return {
      membershipId: membership.id,
      userId: membership.user_id,
      email: profile?.email ?? authUser?.email ?? membership.user_id,
      fullName: profile?.full_name ?? authUser?.fullName ?? null,
      role: membership.role,
      isActive: membership.is_active,
      contentLabAccess: membership.content_lab_access,
    };
  });
}
