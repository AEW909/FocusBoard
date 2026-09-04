"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientMemberships, clients } from "@/lib/db/schema";
import { requireManagedFocusClientById } from "@/lib/focus-board/access";
import { findAuthUserByEmail } from "@/lib/focus-board/memberships";

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getManagePath(clientId: string, message?: string, error?: string) {
  const params = new URLSearchParams();

  if (message) {
    params.set("membershipMessage", message);
  }

  if (error) {
    params.set("membershipError", error);
  }

  const query = params.toString();
  return query ? `/clients/${clientId}/manage?${query}` : `/clients/${clientId}/manage`;
}

function revalidateMembershipPaths(clientId: string) {
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}/manage`);
}

export async function addFocusClientMembershipAction(formData: FormData) {
  const clientId = getValue(formData, "clientId");
  const email = getValue(formData, "email");
  const role = getValue(formData, "role");
  const contentLabAccess = getValue(formData, "contentLabAccess") === "true";

  const { user } = await requireManagedFocusClientById(clientId, `/clients/${clientId}/manage`);

  if (!email) {
    redirect(getManagePath(clientId, undefined, "Enter an email address first."));
  }

  if (role !== "client_user" && role !== "client_admin") {
    redirect(getManagePath(clientId, undefined, "Pick a valid FocusBoard role."));
  }

  const authUser = await findAuthUserByEmail(email);

  if (!authUser) {
    redirect(
      getManagePath(
        clientId,
        undefined,
        `No existing signed-in user was found for ${email}.`,
      ),
    );
  }

  const existingRows = await db
    .select({ id: clientMemberships.id })
    .from(clientMemberships)
    .where(and(eq(clientMemberships.clientId, clientId), eq(clientMemberships.userId, authUser.id)))
    .limit(1);

  const existing = existingRows[0];

  if (existing) {
    await db
      .update(clientMemberships)
      .set({
        role,
        isActive: true,
        contentLabAccess,
        updatedBy: user.id,
      })
      .where(and(eq(clientMemberships.id, existing.id), eq(clientMemberships.clientId, clientId)));
  } else {
    await db.insert(clientMemberships).values({
      clientId,
      userId: authUser.id,
      createdBy: user.id,
      role,
      isActive: true,
      contentLabAccess,
      updatedBy: user.id,
    });
  }

  revalidateMembershipPaths(clientId);
  redirect(getManagePath(clientId, `Access granted to ${authUser.email}.`));
}

export async function setFocusClientMembershipContentLabAccessAction(formData: FormData) {
  const clientId = getValue(formData, "clientId");
  const membershipId = getValue(formData, "membershipId");
  const nextContentLabAccess = getValue(formData, "nextContentLabAccess");

  const { user } = await requireManagedFocusClientById(clientId, `/clients/${clientId}/manage`);

  if (!membershipId) {
    redirect(getManagePath(clientId, undefined, "Membership id is missing."));
  }

  const contentLabAccess = nextContentLabAccess === "true";
  await db
    .update(clientMemberships)
    .set({ contentLabAccess, updatedBy: user.id })
    .where(and(eq(clientMemberships.id, membershipId), eq(clientMemberships.clientId, clientId)));

  revalidateMembershipPaths(clientId);
  redirect(
    getManagePath(
      clientId,
      contentLabAccess ? "Content Lab access enabled." : "Content Lab access removed.",
    ),
  );
}

export async function updateFocusClientMembershipRoleAction(formData: FormData) {
  const clientId = getValue(formData, "clientId");
  const membershipId = getValue(formData, "membershipId");
  const role = getValue(formData, "role");

  const { user } = await requireManagedFocusClientById(clientId, `/clients/${clientId}/manage`);

  if (!membershipId) {
    redirect(getManagePath(clientId, undefined, "Membership id is missing."));
  }

  if (role !== "client_user" && role !== "client_admin") {
    redirect(getManagePath(clientId, undefined, "Pick a valid FocusBoard role."));
  }

  await db
    .update(clientMemberships)
    .set({ role, updatedBy: user.id })
    .where(and(eq(clientMemberships.id, membershipId), eq(clientMemberships.clientId, clientId)));

  revalidateMembershipPaths(clientId);
  redirect(getManagePath(clientId, "Client role updated."));
}

export async function setFocusClientMembershipActiveAction(formData: FormData) {
  const clientId = getValue(formData, "clientId");
  const membershipId = getValue(formData, "membershipId");
  const nextActive = getValue(formData, "nextActive");

  const { user } = await requireManagedFocusClientById(clientId, `/clients/${clientId}/manage`);

  if (!membershipId) {
    redirect(getManagePath(clientId, undefined, "Membership id is missing."));
  }

  const isActive = nextActive === "true";
  await db
    .update(clientMemberships)
    .set({ isActive, updatedBy: user.id })
    .where(and(eq(clientMemberships.id, membershipId), eq(clientMemberships.clientId, clientId)));

  revalidateMembershipPaths(clientId);
  redirect(
    getManagePath(
      clientId,
      isActive ? "Client access reactivated." : "Client access removed.",
    ),
  );
}

export async function setFocusClientContentLabEnabledAction(formData: FormData) {
  const clientId = getValue(formData, "clientId");
  const nextEnabled = getValue(formData, "nextEnabled");

  const { user } = await requireManagedFocusClientById(clientId, `/clients/${clientId}/manage`);

  const contentLabEnabled = nextEnabled === "true";
  await db
    .update(clients)
    .set({ contentLabEnabled, updatedBy: user.id })
    .where(eq(clients.id, clientId));

  revalidateMembershipPaths(clientId);
  redirect(
    getManagePath(
      clientId,
      contentLabEnabled ? "Content Lab enabled for this client." : "Content Lab disabled for this client.",
    ),
  );
}
