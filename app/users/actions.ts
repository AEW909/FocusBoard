"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { clients, clientMemberships } from "@/lib/db/schema";
import { requireFocusPlatformOwner } from "@/lib/focus-board/access";

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

  let createdUser: { id: string; email: string } | null = null;

  try {
    const result = await auth.api.createUser({
      body: {
        email,
        password,
        name: fullName || email,
        role: "user",
      },
      headers: await headers(),
    });
    createdUser = result.user;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create the new user.";
    redirect(getUsersPath(undefined, message));
  }

  if (!createdUser) {
    redirect(getUsersPath(undefined, "Failed to create the new user."));
  }

  if (clientId) {
    const clientRows = await db
      .select({ id: clients.id, displayName: clients.displayName, contentLabEnabled: clients.contentLabEnabled })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    const clientRecord = clientRows[0];

    if (!clientRecord) {
      redirect(getUsersPath(undefined, "Pick a valid client for the initial board assignment."));
    }

    await db.insert(clientMemberships).values({
      clientId,
      userId: createdUser.id,
      role,
      isActive: true,
      contentLabAccess: clientRecord.contentLabEnabled ? contentLabAccess : false,
      createdBy: user.id,
      updatedBy: user.id,
    });

    revalidatePath("/users");
    revalidatePath(`/clients/${clientId}/manage`);
    revalidatePath("/clients");
    revalidatePath("/boards");

    redirect(
      getUsersPath(
        `Created ${email} and assigned ${clientRecord.displayName} as the first board.`,
      ),
    );
  }

  revalidatePath("/users");
  redirect(getUsersPath(`Created ${email}. Assign a board when you're ready.`));
}
