"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireFocusPlatformOwner } from "@/lib/focus-board/access";
import { createFocusBoardAdminClient } from "@/lib/focus-board/db";
import { provisionFocusClient } from "@/lib/focus-board/provisioning";
import { getFocusBoardRuntimeConfigByClientId } from "@/lib/focus-board/runtime";

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getClientsPath(message?: string, error?: string) {
  const params = new URLSearchParams();

  if (message) {
    params.set("clientMessage", message);
  }

  if (error) {
    params.set("clientError", error);
  }

  const query = params.toString();
  return query ? `/clients?${query}` : "/clients";
}

export async function createFocusClientAction(formData: FormData) {
  const { user } = await requireFocusPlatformOwner("/clients");

  const displayName = getValue(formData, "displayName");
  const ownerEmail = getValue(formData, "ownerEmail");
  const contentLabEnabled = getValue(formData, "contentLabEnabled") === "true";

  if (!displayName) {
    redirect(getClientsPath(undefined, "Client name is required."));
  }

  try {
    const provisioned = await provisionFocusClient({
      actorUserId: user.id,
      contentLabEnabled,
      displayName,
      ownerEmail: ownerEmail || undefined,
    });

    revalidatePath("/clients");
    revalidatePath("/boards");
    revalidatePath(`/clients/${provisioned.clientId}/manage`);

    const message = provisioned.linkedEmail
      ? `Created ${displayName} and linked ${provisioned.linkedEmail}.`
      : `Created ${displayName}. Add users from the management dashboard when ready.`;

    redirect(getClientsPath(message));
  } catch (error) {
    redirect(
      getClientsPath(
        undefined,
        error instanceof Error ? error.message : "Could not create the client.",
      ),
    );
  }
}

export async function setFocusClientStatusAction(formData: FormData) {
  const { user } = await requireFocusPlatformOwner("/clients");

  const clientId = getValue(formData, "clientId");
  const nextStatus = getValue(formData, "nextStatus");

  if (!clientId || (nextStatus !== "active" && nextStatus !== "inactive")) {
    redirect(getClientsPath(undefined, "Choose a valid client status."));
  }

  const admin = createFocusBoardAdminClient();
  const { error } = await admin
    .from("clients")
    .update({ status: nextStatus, updated_by: user.id })
    .eq("id", clientId);

  if (error) {
    throw new Error(`Failed to update client status: ${error.message}`);
  }

  const runtime = await getFocusBoardRuntimeConfigByClientId(clientId);
  revalidatePath("/clients");
  revalidatePath("/boards");

  if (runtime) {
    revalidatePath(`/board/${runtime.settings.boardSlug}`);
    revalidatePath(`/clients/${clientId}/manage`);
    revalidatePath(`/clients/${clientId}/content`);
  }

  redirect(
    getClientsPath(
      nextStatus === "active" ? "Client reactivated." : "Client deactivated.",
    ),
  );
}
