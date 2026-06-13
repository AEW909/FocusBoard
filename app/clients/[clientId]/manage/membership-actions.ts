"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManagedFocusClientById } from "@/lib/focus-board/access";
import { createFocusBoardAdminClient } from "@/lib/focus-board/db";
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

  const focusAdmin = createFocusBoardAdminClient();
  const { data: existing, error: existingError } = await focusAdmin
    .from("client_memberships")
    .select("id")
    .eq("client_id", clientId)
    .eq("user_id", authUser.id)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to inspect existing client membership: ${existingError.message}`);
  }

  if (existing) {
    const { error } = await focusAdmin
      .from("client_memberships")
      .update({
        role,
        is_active: true,
        content_lab_access: contentLabAccess,
        updated_by: user.id,
      })
      .eq("id", existing.id)
      .eq("client_id", clientId);

    if (error) {
      throw new Error(`Failed to update client membership: ${error.message}`);
    }
  } else {
    const { error } = await focusAdmin.from("client_memberships").insert({
      client_id: clientId,
      user_id: authUser.id,
      created_by: user.id,
      role,
      is_active: true,
      content_lab_access: contentLabAccess,
      updated_by: user.id,
    });

    if (error) {
      throw new Error(`Failed to create client membership: ${error.message}`);
    }
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
  const focusAdmin = createFocusBoardAdminClient();
  const { error } = await focusAdmin
    .from("client_memberships")
    .update({ content_lab_access: contentLabAccess, updated_by: user.id })
    .eq("id", membershipId)
    .eq("client_id", clientId);

  if (error) {
    throw new Error(`Failed to update Content Lab access: ${error.message}`);
  }

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

  const focusAdmin = createFocusBoardAdminClient();
  const { error } = await focusAdmin
    .from("client_memberships")
    .update({ role, updated_by: user.id })
    .eq("id", membershipId)
    .eq("client_id", clientId);

  if (error) {
    throw new Error(`Failed to update membership role: ${error.message}`);
  }

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
  const focusAdmin = createFocusBoardAdminClient();
  const { error } = await focusAdmin
    .from("client_memberships")
    .update({ is_active: isActive, updated_by: user.id })
    .eq("id", membershipId)
    .eq("client_id", clientId);

  if (error) {
    throw new Error(`Failed to update membership status: ${error.message}`);
  }

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
  const focusAdmin = createFocusBoardAdminClient();
  const { error } = await focusAdmin
    .from("clients")
    .update({ content_lab_enabled: contentLabEnabled, updated_by: user.id })
    .eq("id", clientId);

  if (error) {
    throw new Error(`Failed to update client Content Lab status: ${error.message}`);
  }

  revalidateMembershipPaths(clientId);
  redirect(
    getManagePath(
      clientId,
      contentLabEnabled ? "Content Lab enabled for this client." : "Content Lab disabled for this client.",
    ),
  );
}
