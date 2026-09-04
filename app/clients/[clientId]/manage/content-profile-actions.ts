"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clientContentProfiles } from "@/lib/db/schema";
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

  await db
    .insert(clientContentProfiles)
    .values({
      clientId,
      businessName,
      brandVoice: getValue(formData, "brandVoice"),
      targetAudience: getValue(formData, "targetAudience"),
      services: getValue(formData, "services"),
      differentiators: getValue(formData, "differentiators"),
      contentRules: getValue(formData, "contentRules"),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: clientContentProfiles.clientId,
      set: {
        businessName,
        brandVoice: getValue(formData, "brandVoice"),
        targetAudience: getValue(formData, "targetAudience"),
        services: getValue(formData, "services"),
        differentiators: getValue(formData, "differentiators"),
        contentRules: getValue(formData, "contentRules"),
        updatedAt: new Date(),
      },
    });

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
