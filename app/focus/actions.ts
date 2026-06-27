"use server";

import { revalidatePath } from "next/cache";
import { createFocusBoardAdminClient } from "@/lib/focus-board/db";
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

  const admin = createFocusBoardAdminClient();

  if (direction === "add") {
    if (metric.kind === "checkbox") {
      const { data: existing, error: existingError } = await admin
        .from("focus_board_events")
        .select("id")
        .eq("board_key", runtime.settings.boardKey)
        .eq("month_key", eventMonthKey)
        .eq("week_start", weekKey)
        .eq("task_key", taskKey)
        .eq("metric_key", eventMetricKey)
        .limit(1)
        .maybeSingle();

      if (existingError) {
        return { error: existingError.message };
      }

      if (existing) {
        return {};
      }
    }

    const { error } = await admin.from("focus_board_events").insert({
      board_key: runtime.settings.boardKey,
      month_key: eventMonthKey,
      week_start: weekKey,
      task_key: taskKey,
      metric_key: eventMetricKey,
      points: task.isBoosted ? metric.points * 2 : metric.points,
    });

    if (error) {
      return { error: error.message };
    }
  } else if (direction === "remove") {
    if (metric.kind === "checkbox") {
      const { error: deleteError } = await admin
        .from("focus_board_events")
        .delete()
        .eq("board_key", runtime.settings.boardKey)
        .eq("month_key", eventMonthKey)
        .eq("week_start", weekKey)
        .eq("task_key", taskKey)
        .eq("metric_key", eventMetricKey);

      if (deleteError) {
        return { error: deleteError.message };
      }

      revalidatePath(`/board/${runtime.settings.boardSlug}`);
      revalidatePath(`/focus/${runtime.settings.boardSlug}`);
      return {};
    }

    const { data: latest, error: fetchError } = await admin
      .from("focus_board_events")
      .select("id")
      .eq("board_key", runtime.settings.boardKey)
      .eq("month_key", eventMonthKey)
      .eq("week_start", weekKey)
      .eq("task_key", taskKey)
      .eq("metric_key", eventMetricKey)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      return { error: fetchError.message };
    }

    if (latest) {
      const { error: deleteError } = await admin.from("focus_board_events").delete().eq("id", latest.id);

      if (deleteError) {
        return { error: deleteError.message };
      }
    }
  }

  revalidatePath(`/board/${runtime.settings.boardSlug}`);
  revalidatePath(`/focus/${runtime.settings.boardSlug}`);
  return {};
}
