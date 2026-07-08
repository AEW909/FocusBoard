"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireFocusBusinessStatsAccessByClientId } from "@/lib/focus-board/access";
import { getBusinessStatsConfig, normaliseBusinessStatsWeek } from "@/lib/focus-board/business-stats";
import { createFocusBoardAdminClient } from "@/lib/focus-board/db";

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getNumberValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

function getBusinessPath(clientId: string, week: string, message?: string, error?: string) {
  const params = new URLSearchParams({ week });

  if (message) {
    params.set("businessMessage", message);
  }

  if (error) {
    params.set("businessError", error);
  }

  return `/clients/${clientId}/business?${params.toString()}`;
}

export async function saveBusinessStatsEntriesAction(formData: FormData) {
  const clientId = getValue(formData, "clientId");
  const weekStart = normaliseBusinessStatsWeek(getValue(formData, "weekStart"));
  const { user } = await requireFocusBusinessStatsAccessByClientId(
    clientId,
    `/clients/${clientId}/business`,
  );
  const config = await getBusinessStatsConfig(clientId);
  const visibleCategoryIds = new Set(
    config.visibleCategories
      .filter((category) => {
        if (!category.groupId) {
          return true;
        }

        return config.visibleGroups.some((group) => group.id === category.groupId);
      })
      .map((category) => category.id),
  );
  const admin = createFocusBoardAdminClient();

  const updates = await Promise.all(
    Array.from(visibleCategoryIds).map((categoryId) => {
      const value = getNumberValue(formData.get(`value:${categoryId}`));

      if (value === null) {
        return Promise.resolve({ error: null });
      }

      return admin
        .from("business_stat_entries")
        .upsert(
          {
            client_id: clientId,
            category_id: categoryId,
            week_start: weekStart,
            value,
            updated_by: user.id,
            created_by: user.id,
          },
          { onConflict: "category_id,week_start" },
        );
    }),
  );
  const failed = updates.find((result) => result.error);

  if (failed?.error) {
    redirect(getBusinessPath(clientId, weekStart, undefined, failed.error.message));
  }

  revalidatePath(`/clients/${clientId}/business`);
  redirect(getBusinessPath(clientId, weekStart, "Weekly business stats saved."));
}
