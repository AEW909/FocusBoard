import { db } from "@/lib/db";
import {
  clientMemberships,
  neonAuthUser,
} from "@/lib/db/schema";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

export type FocusClientMembershipSummary = {
  membershipId: string;
  userId: string;
  email: string;
  fullName: string | null;
  role: "client_admin" | "client_user";
  isActive: boolean;
  contentLabAccess: boolean;
};

export type AuthUserSummary = {
  id: string;
  email: string;
  fullName: string | null;
  createdAt: string | null;
};

function normaliseEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function listAllAuthUsers(): Promise<AuthUserSummary[]> {
  const rows = await db
    .select({
      id: neonAuthUser.id,
      email: neonAuthUser.email,
      name: neonAuthUser.name,
      createdAt: neonAuthUser.createdAt,
    })
    .from(neonAuthUser);

  return rows.map((row) => ({
    id: row.id,
    email: row.email.trim().toLowerCase(),
    fullName: row.name || null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : null,
  }));
}

async function tryListAllAuthUsers() {
  try {
    return await listAllAuthUsers();
  } catch (error) {
    console.error("FocusBoard auth user lookup failed:", error);
    return [] satisfies AuthUserSummary[];
  }
}

export async function findAuthUserByEmail(email: string) {
  const targetEmail = normaliseEmail(email);

  if (!targetEmail) {
    return null;
  }

  const rows = await db
    .select({ id: neonAuthUser.id, email: neonAuthUser.email, name: neonAuthUser.name })
    .from(neonAuthUser)
    .where(eq(neonAuthUser.email, targetEmail))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    email: row.email.trim().toLowerCase(),
    fullName: row.name || null,
    createdAt: null,
  } satisfies AuthUserSummary;
}

export async function getManagedFocusClientMemberships(clientId: string) {
  const membershipRows = await db
    .select({
      id: clientMemberships.id,
      userId: clientMemberships.userId,
      role: clientMemberships.role,
      isActive: clientMemberships.isActive,
      contentLabAccess: clientMemberships.contentLabAccess,
    })
    .from(clientMemberships)
    .where(eq(clientMemberships.clientId, clientId))
    .orderBy(desc(clientMemberships.isActive), asc(clientMemberships.role));

  if (membershipRows.length === 0) {
    return [] satisfies FocusClientMembershipSummary[];
  }

  const userIds = membershipRows.map((m) => m.userId);
  const userRows = await db
    .select({ id: neonAuthUser.id, email: neonAuthUser.email, name: neonAuthUser.name })
    .from(neonAuthUser)
    .where(inArray(neonAuthUser.id, userIds));

  const usersById = new Map(userRows.map((u) => [u.id, u]));

  return membershipRows.map((membership) => {
    const user = usersById.get(membership.userId);
    return {
      membershipId: membership.id,
      userId: membership.userId,
      email: user?.email ?? membership.userId,
      fullName: user?.name ?? null,
      role: membership.role as FocusClientMembershipSummary["role"],
      isActive: membership.isActive,
      contentLabAccess: membership.contentLabAccess,
    };
  });
}
