"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createFocusBoardAdminClient } from "@/lib/focus-board/db";
import { getFocusBoardRuntimeConfigByClientId } from "@/lib/focus-board/runtime";
import { requireManagedFocusClientById } from "@/lib/focus-board/access";

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getContentProfilePath(
  clientId: string,
  message?: string,
  error?: string,
  returnPath?: string,
) {
  const params = new URLSearchParams();
  const basePath = returnPath?.startsWith(`/clients/${clientId}/manage`)
    ? returnPath
    : `/clients/${clientId}/manage`;

  if (message) {
    params.set("contentProfileMessage", message);
  }

  if (error) {
    params.set("contentProfileError", error);
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export async function updateFocusClientContentProfileAction(formData: FormData) {
  const clientId = getValue(formData, "clientId");
  const returnPath = getValue(formData, "returnPath");

  await requireManagedFocusClientById(clientId, `/clients/${clientId}/manage`);

  const businessName = getValue(formData, "businessName");

  if (!businessName) {
    redirect(getContentProfilePath(clientId, undefined, "Business name is required.", returnPath));
  }

  const admin = createFocusBoardAdminClient();
  const { error } = await admin
    .from("client_content_profiles")
    .upsert({
      client_id: clientId,
      business_name: businessName,
      brand_voice: getValue(formData, "brandVoice"),
      target_audience: getValue(formData, "targetAudience"),
      services: getValue(formData, "services"),
      differentiators: getValue(formData, "differentiators"),
      content_rules: getValue(formData, "contentRules"),
      updated_at: new Date().toISOString(),
    });

  if (error) {
    throw new Error(`Failed to update client content profile: ${error.message}`);
  }

  const runtime = await getFocusBoardRuntimeConfigByClientId(clientId);
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}/manage`);
  revalidatePath(`/clients/${clientId}/manage/content-lab`);

  if (runtime) {
    revalidatePath(`/clients/${clientId}/content`);
    revalidatePath(`/focus-content/${runtime.settings.boardSlug}`);
  }

  redirect(getContentProfilePath(clientId, "Content Lab profile saved.", undefined, returnPath));
}
