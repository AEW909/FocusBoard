"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { focusBoardEvents } from "@/lib/db/schema";
import { requireFocusBoardAccessBySlug } from "@/lib/focus-board/access";
import { getWeekMonthKey, getWeekStart, toIsoDate } from "@/lib/focus-board/dates";
import { getFocusBoardRuntimeConfigByPublicSlug } from "@/lib/focus-board/runtime";

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export type UpdateFocusBoardState = {
  error?: string;
};

function getCurrentWeekKey() {
  return toIsoDate(getWeekStart());
}

export async function updateFocusBoardAction(
  _prevState: UpdateFocusBoardState,
  formData: FormData,
): Promise<UpdateFocusBoardState> {
  const slug = getValue(formData, "slug");
  const weekKey = getValue(formData, "weekKey");
  const taskKey = getValue(formData, "taskKey");
  const metricKey = getValue(formData, "metricKey");
  const checkboxKey = getValue(formData, "checkboxKey");
  const direction = getValue(formData, "direction");
  await requireFocusBoardAccessBySlug(slug, `/board/${slug}`);

  const runtime = await getFocusBoardRuntimeConfigByPublicSlug(slug);

  if (!runtime) {
    return { error: "This focus board link is not valid." };
  }

  const task = runtime.allTasks.find((item) => item.key === taskKey);
  const metric = task?.metrics.find((item) => item.key === metricKey);
  const section = runtime.allSections.find((item) => item.id === task?.sectionId);
  const eventMonthKey = getWeekMonthKey(weekKey);

  if (!task || !metric || !weekKey || !eventMonthKey) {
    return { error: "The board action is missing some context." };
  }

  const checkboxOption =
    metric.kind === "checkbox"
      ? metric.checkboxOptions?.find((option) => option.key === checkboxKey)
      : null;

  if (metric.kind === "checkbox" && !checkboxOption) {
    return { error: "That checkbox is no longer available. Please refresh the board and try again." };
  }

  const eventMetricKey = metric.kind === "checkbox" ? `${metric.key}:${checkboxOption?.key}` : metric.key;

  if (
    section?.isActive === false ||
    section?.isVisible === false ||
    task.isActive === false ||
    task.isVisible === false ||
    metric.isActive === false
  ) {
    return { error: "That challenge has changed, so please refresh the board and try again." };
  }

  if (weekKey > getCurrentWeekKey()) {
    return { error: "Future weeks are locked until they become current." };
  }

  if (direction === "add") {
    if (metric.kind === "checkbox") {
      const existing = await db
        .select({ id: focusBoardEvents.id })
        .from(focusBoardEvents)
        .where(
          and(
            eq(focusBoardEvents.boardKey, runtime.settings.boardKey),
            eq(focusBoardEvents.monthKey, eventMonthKey),
            eq(focusBoardEvents.weekStart, weekKey),
            eq(focusBoardEvents.taskKey, taskKey),
            eq(focusBoardEvents.metricKey, eventMetricKey),
          ),
        )
        .limit(1);

      if (existing[0]) {
        return {};
      }
    }

    await db.insert(focusBoardEvents).values({
      boardKey: runtime.settings.boardKey,
      monthKey: eventMonthKey,
      weekStart: weekKey,
      taskKey,
      metricKey: eventMetricKey,
      points: task.isBoosted ? metric.points * 2 : metric.points,
    });
  } else if (direction === "remove") {
    if (metric.kind === "checkbox") {
      await db
        .delete(focusBoardEvents)
        .where(
          and(
            eq(focusBoardEvents.boardKey, runtime.settings.boardKey),
            eq(focusBoardEvents.monthKey, eventMonthKey),
            eq(focusBoardEvents.weekStart, weekKey),
            eq(focusBoardEvents.taskKey, taskKey),
            eq(focusBoardEvents.metricKey, eventMetricKey),
          ),
        );

      revalidatePath(`/board/${runtime.settings.boardSlug}`);
      revalidatePath(`/focus/${runtime.settings.boardSlug}`);
      return {};
    }

    const latest = await db
      .select({ id: focusBoardEvents.id })
      .from(focusBoardEvents)
      .where(
        and(
          eq(focusBoardEvents.boardKey, runtime.settings.boardKey),
          eq(focusBoardEvents.monthKey, eventMonthKey),
          eq(focusBoardEvents.weekStart, weekKey),
          eq(focusBoardEvents.taskKey, taskKey),
          eq(focusBoardEvents.metricKey, eventMetricKey),
        ),
      )
      .orderBy(desc(focusBoardEvents.createdAt))
      .limit(1);

    if (latest[0]) {
      await db.delete(focusBoardEvents).where(eq(focusBoardEvents.id, latest[0].id));
    }
  }

  revalidatePath(`/board/${runtime.settings.boardSlug}`);
  revalidatePath(`/focus/${runtime.settings.boardSlug}`);
  return {};
}
