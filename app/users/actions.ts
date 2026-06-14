"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireFocusPlatformOwner } from "@/lib/focus-board/access";
import { createFocusBoardAdminClient } from "@/lib/focus-board/db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getUsersPath(message?: string, error?: string) {
  const params = new URLSearchParams();

  if (message) {
    params.set("userMessage", message);
  }

  if (error) {
    params.set("userError", error);
  }

  const query = params.toString();
  return query ? `/users?${query}` : "/users";
}

export async function createFocusUserAction(formData: FormData) {
  const email = getValue(formData, "email").toLowerCase();
  const fullName = getValue(formData, "fullName");
  const password = getValue(formData, "password");
  const clientId = getValue(formData, "clientId");
  const role = getValue(formData, "role");
  const contentLabAccess = getValue(formData, "contentLabAccess") === "true";

  const { user } = await requireFocusPlatformOwner("/users");

  if (!email) {
    redirect(getUsersPath(undefined, "Enter an email address first."));
  }

  if (!password || password.length < 8) {
    redirect(getUsersPath(undefined, "Use an initial password with at least 8 characters."));
  }

  if (role !== "client_user" && role !== "client_admin") {
    redirect(getUsersPath(undefined, "Pick a valid initial FocusBoard role."));
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: createdUserResult, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });

  if (createUserError || !createdUserResult.user) {
    redirect(getUsersPath(undefined, createUserError?.message ?? "Failed to create the new user."));
  }

  const createdUser = createdUserResult.user;
  const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
    {
      id: createdUser.id,
      email,
      full_name: fullName || null,
    },
    {
      onConflict: "id",
    },
  );

  if (profileError) {
    throw new Error(`Failed to upsert the shared profile row: ${profileError.message}`);
  }

  if (clientId) {
    const focusAdmin = createFocusBoardAdminClient();
    const { data: clientRecord, error: clientError } = await focusAdmin
      .from("clients")
      .select("id, display_name, content_lab_enabled")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError) {
      throw new Error(`Failed to inspect the selected client: ${clientError.message}`);
    }

    if (!clientRecord) {
      redirect(getUsersPath(undefined, "Pick a valid client for the initial board assignment."));
    }

    const { error: membershipError } = await focusAdmin.from("client_memberships").insert({
      client_id: clientId,
      user_id: createdUser.id,
      role,
      is_active: true,
      content_lab_access: clientRecord.content_lab_enabled ? contentLabAccess : false,
      created_by: user.id,
      updated_by: user.id,
    });

    if (membershipError) {
      throw new Error(`Failed to create the initial FocusBoard membership: ${membershipError.message}`);
    }

    revalidatePath("/users");
    revalidatePath(`/clients/${clientId}/manage`);
    revalidatePath("/clients");
    revalidatePath("/boards");

    redirect(
      getUsersPath(
        `Created ${email} and assigned ${clientRecord.display_name} as the first board.`,
      ),
    );
  }

  revalidatePath("/users");
  redirect(getUsersPath(`Created ${email}. Assign a board when you're ready.`));
}
