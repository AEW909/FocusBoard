"use server";

import { revalidatePath } from "next/cache";
import { createFocusBoardAdminClient } from "@/lib/focus-board/db";
import { getFocusBoardRuntimeConfigByPublicSlug } from "@/lib/focus-board/runtime";

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export type UpdateFocusBoardState = {
  error?: string;
};

function getCurrentWeekKey() {
  const now = new Date();
  const copy = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = copy.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setUTCDate(copy.getUTCDate() + diff);
  return copy.toISOString().slice(0, 10);
}

export async function updateFocusBoardAction(
  _prevState: UpdateFocusBoardState,
  formData: FormData,
): Promise<UpdateFocusBoardState> {
  const slug = getValue(formData, "slug");
  const weekKey = getValue(formData, "weekKey");
  const monthKey = getValue(formData, "monthKey");
  const taskKey = getValue(formData, "taskKey");
  const metricKey = getValue(formData, "metricKey");
  const direction = getValue(formData, "direction");

  const runtime = await getFocusBoardRuntimeConfigByPublicSlug(slug);

  if (!runtime) {
    return { error: "This focus board link is not valid." };
  }

  const task = runtime.allTasks.find((item) => item.key === taskKey);
  const metric = task?.metrics.find((item) => item.key === metricKey);

  if (!task || !metric || !weekKey || !monthKey) {
    return { error: "The board action is missing some context." };
  }

  if (task.isActive === false || task.isVisible === false || metric.isActive === false) {
    return { error: "That challenge has changed, so please refresh the board and try again." };
  }

  if (weekKey > getCurrentWeekKey()) {
    return { error: "Future weeks are locked until they become current." };
  }

  const admin = createFocusBoardAdminClient();

  if (direction === "add") {
    const { error } = await admin.from("focus_board_events").insert({
      board_key: runtime.settings.boardKey,
      month_key: monthKey,
      week_start: weekKey,
      task_key: taskKey,
      metric_key: metricKey,
      points: metric.points,
    });

    if (error) {
      return { error: error.message };
    }
  } else if (direction === "remove") {
    const { data: latest, error: fetchError } = await admin
      .from("focus_board_events")
      .select("id")
      .eq("board_key", runtime.settings.boardKey)
      .eq("month_key", monthKey)
      .eq("week_start", weekKey)
      .eq("task_key", taskKey)
      .eq("metric_key", metricKey)
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

  revalidatePath(`/focus/${runtime.settings.boardSlug}`);
  return {};
}
