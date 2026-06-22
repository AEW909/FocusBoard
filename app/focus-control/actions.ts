"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireFocusPlatformOwner } from "@/lib/focus-board/access";
import {
  FOCUS_THEME_PRESETS,
  getAccentClassForIndex,
  normaliseFocusKey,
  type FocusMetricKind,
  type FocusThemePreset,
} from "@/lib/focus-board/config";
import { createFocusBoardAdminClient } from "@/lib/focus-board/db";
import { getFocusBoardRuntimeConfigByAdminSlug } from "@/lib/focus-board/runtime";

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getIntValue(formData: FormData, key: string, fallback = 0) {
  const raw = getValue(formData, key);
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : fallback;
}

async function getAdminContext(adminSlug: string) {
  await requireFocusPlatformOwner();
  const runtime = await getFocusBoardRuntimeConfigByAdminSlug(adminSlug);

  if (!runtime) {
    throw new Error("This focus control link is not valid.");
  }

  return runtime;
}

function getManagePath(clientId: string | null, adminSlug: string) {
  return clientId ? `/clients/${clientId}/manage` : `/focus-control/${adminSlug}`;
}

function getManagePathWithFeedback(
  clientId: string | null,
  adminSlug: string,
  message?: string,
  error?: string,
) {
  const basePath = getManagePath(clientId, adminSlug);
  const params = new URLSearchParams();

  if (message) {
    params.set("boardSettingsMessage", message);
  }

  if (error) {
    params.set("boardSettingsError", error);
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function getManagePathWithChallengeFeedback(
  clientId: string | null,
  adminSlug: string,
  message?: string,
  error?: string,
) {
  const basePath = getManagePath(clientId, adminSlug);
  const params = new URLSearchParams();

  if (message) {
    params.set("challengeMessage", message);
  }

  if (error) {
    params.set("challengeError", error);
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function revalidateFocusPaths(boardSlug: string, adminSlug: string, clientId: string | null) {
  revalidatePath(`/board/${boardSlug}`);
  revalidatePath(`/clients`);
  if (clientId) {
    revalidatePath(`/clients/${clientId}/manage`);
  }
  revalidatePath(`/focus/${boardSlug}`);
  revalidatePath(`/focus-control/${adminSlug}`);
}

export async function updateFocusBoardSettingsAction(formData: FormData) {
  const adminSlug = getValue(formData, "adminSlug");
  const runtime = await getAdminContext(adminSlug);
  const admin = createFocusBoardAdminClient();

  const title = getValue(formData, "title") || runtime.settings.title;
  const subtitle = getValue(formData, "subtitle") || runtime.settings.subtitle;
  const weeklyTarget = Math.max(1, getIntValue(formData, "weeklyTarget", runtime.settings.weeklyTarget));
  const requestedTheme = getValue(formData, "themePreset");
  const themePreset = FOCUS_THEME_PRESETS.includes(requestedTheme as FocusThemePreset)
    ? (requestedTheme as FocusThemePreset)
    : runtime.settings.themePreset;

  const { error } = await admin
    .from("focus_board_settings")
    .update({
      title,
      subtitle,
      theme_preset: themePreset,
      weekly_target: weeklyTarget,
    })
    .eq("board_key", runtime.settings.boardKey);

  if (error) {
    redirect(
      getManagePathWithFeedback(
        runtime.settings.clientId,
        runtime.settings.adminSlug,
        undefined,
        `Could not save board settings: ${error.message}`,
      ),
    );
  }

  revalidateFocusPaths(
    runtime.settings.boardSlug,
    runtime.settings.adminSlug,
    runtime.settings.clientId,
  );
  redirect(
    getManagePathWithFeedback(
      runtime.settings.clientId,
      runtime.settings.adminSlug,
      "Board settings saved.",
    ),
  );
}

export async function updateFocusWeeklyRewardAction(formData: FormData) {
  const adminSlug = getValue(formData, "adminSlug");
  const runtime = await getAdminContext(adminSlug);
  const admin = createFocusBoardAdminClient();

  const { error } = await admin
    .from("focus_board_settings")
    .update({
      weekly_target: Math.max(1, getIntValue(formData, "weeklyTarget", runtime.settings.weeklyTarget)),
      weekly_reward_label: getValue(formData, "label") || runtime.weeklyReward.label,
      weekly_reward_locked_description:
        getValue(formData, "lockedDescription") || runtime.weeklyReward.lockedDescription,
      weekly_reward_unlocked_description:
        getValue(formData, "unlockedDescription") || runtime.weeklyReward.unlockedDescription,
      weekly_reward_locked_sticker_src:
        getValue(formData, "lockedStickerSrc") || runtime.weeklyReward.lockedStickerSrc,
      weekly_reward_unlocked_sticker_src:
        getValue(formData, "unlockedStickerSrc") || runtime.weeklyReward.unlockedStickerSrc,
      weekly_reward_sticker_alt: getValue(formData, "stickerAlt") || runtime.weeklyReward.stickerAlt,
    })
    .eq("board_key", runtime.settings.boardKey);

  if (error) {
    throw new Error(error.message);
  }

  revalidateFocusPaths(
    runtime.settings.boardSlug,
    runtime.settings.adminSlug,
    runtime.settings.clientId,
  );
  redirect(getManagePath(runtime.settings.clientId, runtime.settings.adminSlug));
}

export async function addFocusBoardTaskAction(formData: FormData) {
  const adminSlug = getValue(formData, "adminSlug");
  const runtime = await getAdminContext(adminSlug);
  const admin = createFocusBoardAdminClient();

  const title = getValue(formData, "title");
  const description = getValue(formData, "description");
  const metricLabel = getValue(formData, "metricLabel");

  if (!title || !description || !metricLabel) {
    redirect(
      getManagePathWithChallengeFeedback(
        runtime.settings.clientId,
        runtime.settings.adminSlug,
        undefined,
        "New goals need a title, description, and metric label.",
      ),
    );
  }

  const currentSort = runtime.tasks.length + 1;
  const taskKey = normaliseFocusKey(getValue(formData, "taskKey") || title);
  const metricKey = normaliseFocusKey(getValue(formData, "metricKey") || metricLabel);
  const icon = (getValue(formData, "icon") || title.slice(0, 4)).toUpperCase().slice(0, 6);
  const stickerSrc = getValue(formData, "stickerSrc") || "/focus/mascot-rainbow.svg";
  const stickerAlt = getValue(formData, "stickerAlt") || `${title} sticker`;
  const accentClass = getAccentClassForIndex(runtime.tasks.length);
  const target = Math.max(0, getIntValue(formData, "target", 1));
  const points = getIntValue(formData, "points", 1);
  const kind = (getValue(formData, "kind") || "count") as FocusMetricKind;

  const { data: taskRow, error: taskError } = await admin
    .from("focus_board_tasks")
    .insert({
      board_key: runtime.settings.boardKey,
      task_key: taskKey,
      icon,
      sticker_src: stickerSrc,
      sticker_alt: stickerAlt,
      title,
      description,
      accent_class: accentClass,
      sort_order: currentSort,
    })
    .select("id")
    .single();

  if (taskError || !taskRow) {
    const message =
      taskError?.code === "23505"
        ? `A challenge with the key "${taskKey}" already exists. Try a more specific title.`
        : taskError?.message ?? "Could not create the new goal.";

    redirect(
      getManagePathWithChallengeFeedback(
        runtime.settings.clientId,
        runtime.settings.adminSlug,
        undefined,
        message,
      ),
    );
  }

  const { error: metricError } = await admin.from("focus_board_task_metrics").insert({
    task_id: taskRow.id,
    metric_key: metricKey,
    label: metricLabel,
    target,
    points,
    kind,
    sort_order: 1,
  });

  if (metricError) {
    await admin
      .from("focus_board_tasks")
      .delete()
      .eq("id", taskRow.id)
      .eq("board_key", runtime.settings.boardKey);

    redirect(
      getManagePathWithChallengeFeedback(
        runtime.settings.clientId,
        runtime.settings.adminSlug,
        undefined,
        `Could not create the scoring metric: ${metricError.message}`,
      ),
    );
  }

  revalidateFocusPaths(
    runtime.settings.boardSlug,
    runtime.settings.adminSlug,
    runtime.settings.clientId,
  );
  redirect(
    getManagePathWithChallengeFeedback(
      runtime.settings.clientId,
      runtime.settings.adminSlug,
      `Challenge "${title}" added.`,
    ),
  );
}

export async function updateFocusBoardTaskAction(formData: FormData) {
  const adminSlug = getValue(formData, "adminSlug");
  const runtime = await getAdminContext(adminSlug);
  const admin = createFocusBoardAdminClient();

  const taskId = getValue(formData, "taskId");
  if (!taskId) {
    throw new Error("Task id missing.");
  }

  await admin
    .from("focus_board_tasks")
    .update({
      title: getValue(formData, "title"),
      description: getValue(formData, "description"),
      icon: (getValue(formData, "icon") || "TASK").toUpperCase().slice(0, 6),
      sticker_src: getValue(formData, "stickerSrc") || "/focus/mascot-rainbow.svg",
      sticker_alt: getValue(formData, "stickerAlt") || "Goal sticker",
      is_boosted: getValue(formData, "isBoosted") === "true",
    })
    .eq("id", taskId)
    .eq("board_key", runtime.settings.boardKey);

  revalidateFocusPaths(
    runtime.settings.boardSlug,
    runtime.settings.adminSlug,
    runtime.settings.clientId,
  );
}

export async function reorderFocusBoardTasksAction(formData: FormData) {
  const adminSlug = getValue(formData, "adminSlug");
  const runtime = await getAdminContext(adminSlug);
  const admin = createFocusBoardAdminClient();
  const orderedTaskIds = formData
    .getAll("taskIds")
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  const knownTaskIds = new Set(runtime.tasks.map((task) => task.id).filter(Boolean));

  if (orderedTaskIds.length !== runtime.tasks.length) {
    throw new Error("The challenge order is out of date. Refresh and try again.");
  }

  if (!orderedTaskIds.every((taskId) => knownTaskIds.has(taskId))) {
    throw new Error("One of those challenges does not belong to this board.");
  }

  const updates = await Promise.all(
    orderedTaskIds.map((taskId, index) =>
      admin
        .from("focus_board_tasks")
        .update({ sort_order: index + 1 })
        .eq("id", taskId)
        .eq("board_key", runtime.settings.boardKey),
    ),
  );
  const failedUpdate = updates.find((result) => result.error);

  if (failedUpdate?.error) {
    throw new Error(failedUpdate.error.message);
  }

  revalidateFocusPaths(
    runtime.settings.boardSlug,
    runtime.settings.adminSlug,
    runtime.settings.clientId,
  );
}

export async function toggleFocusBoardTaskVisibilityAction(formData: FormData) {
  const adminSlug = getValue(formData, "adminSlug");
  const runtime = await getAdminContext(adminSlug);
  const admin = createFocusBoardAdminClient();

  const taskId = getValue(formData, "taskId");
  const nextVisible = getValue(formData, "nextVisible");

  if (!taskId) {
    throw new Error("Task id missing.");
  }

  const shouldShow = nextVisible === "true";
  const taskUpdate = shouldShow
    ? {
        is_active: true,
        is_visible: true,
      }
    : {
        is_visible: false,
      };

  const { error: taskError } = await admin
    .from("focus_board_tasks")
    .update(taskUpdate)
    .eq("id", taskId)
    .eq("board_key", runtime.settings.boardKey);

  if (taskError) {
    throw new Error(taskError.message);
  }

  if (shouldShow) {
    const { error: metricsError } = await admin.from("focus_board_task_metrics").update({ is_active: true }).eq("task_id", taskId);

    if (metricsError) {
      throw new Error(metricsError.message);
    }
  }

  revalidateFocusPaths(
    runtime.settings.boardSlug,
    runtime.settings.adminSlug,
    runtime.settings.clientId,
  );
}

export async function deleteFocusBoardTaskAction(formData: FormData) {
  const adminSlug = getValue(formData, "adminSlug");
  const runtime = await getAdminContext(adminSlug);
  const admin = createFocusBoardAdminClient();

  const taskId = getValue(formData, "taskId");
  if (!taskId) {
    throw new Error("Task id missing.");
  }

  await admin
    .from("focus_board_tasks")
    .update({
      is_active: false,
      is_visible: false,
    })
    .eq("id", taskId)
    .eq("board_key", runtime.settings.boardKey);

  await admin.from("focus_board_task_metrics").update({ is_active: false }).eq("task_id", taskId);

  revalidateFocusPaths(
    runtime.settings.boardSlug,
    runtime.settings.adminSlug,
    runtime.settings.clientId,
  );
}

export async function addFocusBoardMetricAction(formData: FormData) {
  const adminSlug = getValue(formData, "adminSlug");
  const runtime = await getAdminContext(adminSlug);
  const admin = createFocusBoardAdminClient();

  const taskId = getValue(formData, "taskId");
  const metricLabel = getValue(formData, "metricLabel");

  if (!taskId || !metricLabel) {
    throw new Error("Metric details missing.");
  }

  const task = runtime.allTasks.find((item) => item.id === taskId);
  if (!task) {
    throw new Error("Task not found.");
  }

  const metricKey = normaliseFocusKey(getValue(formData, "metricKey") || metricLabel);
  const { error } = await admin.from("focus_board_task_metrics").insert({
    task_id: taskId,
    metric_key: metricKey,
    label: metricLabel,
    target: Math.max(0, getIntValue(formData, "target", 0)),
    points: getIntValue(formData, "points", 1),
    kind: (getValue(formData, "kind") || "count") as FocusMetricKind,
    sort_order: task.metrics.length + 1,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error(`A metric named "${metricLabel}" already exists in this goal.`);
    }

    throw new Error(error.message);
  }

  revalidateFocusPaths(
    runtime.settings.boardSlug,
    runtime.settings.adminSlug,
    runtime.settings.clientId,
  );
}

export async function updateFocusBoardMetricAction(formData: FormData) {
  const adminSlug = getValue(formData, "adminSlug");
  const runtime = await getAdminContext(adminSlug);
  const admin = createFocusBoardAdminClient();

  const metricId = getValue(formData, "metricId");
  if (!metricId) {
    throw new Error("Metric id missing.");
  }

  const metricBelongsToBoard = runtime.allTasks.some((task) =>
    task.metrics.some((metric) => metric.id === metricId),
  );

  if (!metricBelongsToBoard) {
    throw new Error("Metric not found.");
  }

  await admin
    .from("focus_board_task_metrics")
    .update({
      label: getValue(formData, "label"),
      target: Math.max(0, getIntValue(formData, "target", 0)),
      points: getIntValue(formData, "points", 0),
      kind: (getValue(formData, "kind") || "count") as FocusMetricKind,
    })
    .eq("id", metricId);

  revalidateFocusPaths(
    runtime.settings.boardSlug,
    runtime.settings.adminSlug,
    runtime.settings.clientId,
  );
}

export async function toggleFocusBoardMetricVisibilityAction(formData: FormData) {
  const adminSlug = getValue(formData, "adminSlug");
  const runtime = await getAdminContext(adminSlug);
  const admin = createFocusBoardAdminClient();

  const metricId = getValue(formData, "metricId");
  const nextVisible = getValue(formData, "nextVisible");

  if (!metricId) {
    throw new Error("Metric id missing.");
  }

  const metricBelongsToBoard = runtime.allTasks.some((task) =>
    task.metrics.some((metric) => metric.id === metricId),
  );

  if (!metricBelongsToBoard) {
    throw new Error("Metric not found.");
  }

  const shouldShow = nextVisible === "true";
  const { error } = await admin
    .from("focus_board_task_metrics")
    .update(
      shouldShow
        ? {
            is_active: true,
            is_visible: true,
          }
        : {
            is_visible: false,
          },
    )
    .eq("id", metricId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateFocusPaths(
    runtime.settings.boardSlug,
    runtime.settings.adminSlug,
    runtime.settings.clientId,
  );
}

export async function deleteFocusBoardMetricAction(formData: FormData) {
  const adminSlug = getValue(formData, "adminSlug");
  const runtime = await getAdminContext(adminSlug);
  const admin = createFocusBoardAdminClient();

  const metricId = getValue(formData, "metricId");
  const taskId = getValue(formData, "taskId");

  if (!metricId || !taskId) {
    throw new Error("Metric context missing.");
  }

  const task = runtime.allTasks.find((item) => item.id === taskId);
  const metricBelongsToTask = task?.metrics.some((metric) => metric.id === metricId);

  if (!task || !metricBelongsToTask) {
    throw new Error("Task not found.");
  }

  if (task.metrics.length <= 1) {
    throw new Error("Delete the whole challenge instead of removing its final metric.");
  }

  await admin.from("focus_board_task_metrics").update({ is_active: false }).eq("id", metricId);

  revalidateFocusPaths(
    runtime.settings.boardSlug,
    runtime.settings.adminSlug,
    runtime.settings.clientId,
  );
}

export async function updateFocusRewardTierAction(formData: FormData) {
  const adminSlug = getValue(formData, "adminSlug");
  const runtime = await getAdminContext(adminSlug);
  const admin = createFocusBoardAdminClient();

  const rewardId = getValue(formData, "rewardId");
  if (!rewardId) {
    throw new Error("Reward id missing.");
  }

  const { error } = await admin
    .from("focus_board_reward_tiers")
    .update({
      label: getValue(formData, "label"),
      description: getValue(formData, "description"),
      min_points: Math.max(0, getIntValue(formData, "minPoints", 0)),
      min_weeks_hit: Math.max(0, getIntValue(formData, "minWeeksHit", 0)),
      locked_sticker_src: getValue(formData, "lockedStickerSrc"),
      unlocked_sticker_src: getValue(formData, "unlockedStickerSrc"),
      sticker_alt: getValue(formData, "stickerAlt"),
    })
    .eq("id", rewardId)
    .eq("board_key", runtime.settings.boardKey);

  if (error) {
    throw new Error(error.message);
  }

  revalidateFocusPaths(
    runtime.settings.boardSlug,
    runtime.settings.adminSlug,
    runtime.settings.clientId,
  );
  redirect(getManagePath(runtime.settings.clientId, runtime.settings.adminSlug));
}
