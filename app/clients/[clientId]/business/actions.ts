"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { businessStatEntries } from "@/lib/db/schema";
import { requireFocusBusinessStatsAccessByClientId } from "@/lib/focus-board/access";
import { getBusinessStatsConfig, normaliseBusinessStatsWeek } from "@/lib/focus-board/business-stats";

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

  try {
    await Promise.all(
      Array.from(visibleCategoryIds).map((categoryId) => {
        const value = getNumberValue(formData.get(`value:${categoryId}`));

        if (value === null) {
          return Promise.resolve();
        }

        return db
          .insert(businessStatEntries)
          .values({
            clientId,
            categoryId,
            weekStart,
            value: value.toString(),
            updatedBy: user.id,
            createdBy: user.id,
          })
          .onConflictDoUpdate({
            target: [businessStatEntries.categoryId, businessStatEntries.weekStart],
            set: {
              value: value.toString(),
              updatedBy: user.id,
            },
          });
      }),
    );
  } catch (error) {
    redirect(
      getBusinessPath(
        clientId,
        weekStart,
        undefined,
        error instanceof Error ? error.message : "Could not save business stats.",
      ),
    );
  }

  revalidatePath(`/clients/${clientId}/business`);
  redirect(getBusinessPath(clientId, weekStart, "Weekly business stats saved."));
}
