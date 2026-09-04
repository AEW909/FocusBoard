"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  focusBoardSettings,
  focusBoardSections,
  focusBoardTasks,
  focusBoardTaskMetrics,
  focusBoardRewardTiers,
} from "@/lib/db/schema";
import { requireFocusPlatformOwner } from "@/lib/focus-board/access";
import {
  DEFAULT_FOCUS_CHECKBOX_OPTIONS,
  FOCUS_THEME_PRESETS,
  getAccentClassForIndex,
  normaliseFocusCheckboxOptions,
  normaliseFocusKey,
  type FocusMetricKind,
  type FocusCheckboxOption,
  type FocusThemePreset,
} from "@/lib/focus-board/config";
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

function getMetricKind(formData: FormData): FocusMetricKind {
  return getValue(formData, "kind") === "checkbox" ? "checkbox" : "count";
}

function getActiveTaskCountForSection(
  runtime: NonNullable<Awaited<ReturnType<typeof getFocusBoardRuntimeConfigByAdminSlug>>>,
  sectionId: string,
) {
  return runtime.allTasks.filter(
    (task) => task.isActive !== false && task.sectionId === sectionId,
  ).length;
}

function getVisibleTaskCountForSection(
  runtime: NonNullable<Awaited<ReturnType<typeof getFocusBoardRuntimeConfigByAdminSlug>>>,
  sectionId: string,
) {
  return runtime.allTasks.filter(
    (task) => task.isActive !== false && task.isVisible !== false && task.sectionId === sectionId,
  ).length;
}

function getCheckboxOptions(formData: FormData) {
  const raw = getValue(formData, "checkboxOptions");

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Array<Partial<FocusCheckboxOption>>;
      const options = normaliseFocusCheckboxOptions(Array.isArray(parsed) ? parsed : []);
      return options.length > 0 ? options : DEFAULT_FOCUS_CHECKBOX_OPTIONS;
    } catch {
      return DEFAULT_FOCUS_CHECKBOX_OPTIONS;
    }
  }

  const labelOptions = getValue(formData, "checkboxLabels")
    .split(/[\n,]+/)
    .map((label) => ({ label: label.trim() }))
    .filter((option) => option.label);
  const options = normaliseFocusCheckboxOptions(labelOptions);
  return options.length > 0 ? options : DEFAULT_FOCUS_CHECKBOX_OPTIONS;
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

  const title = getValue(formData, "title") || runtime.settings.title;
  const subtitle = getValue(formData, "subtitle") || runtime.settings.subtitle;
  const weeklyTarget = Math.max(1, getIntValue(formData, "weeklyTarget", runtime.settings.weeklyTarget));
  const requestedTheme = getValue(formData, "themePreset");
  const themePreset = FOCUS_THEME_PRESETS.includes(requestedTheme as FocusThemePreset)
    ? (requestedTheme as FocusThemePreset)
    : runtime.settings.themePreset;

  try {
    await db
      .update(focusBoardSettings)
      .set({ title, subtitle, themePreset, weeklyTarget })
      .where(eq(focusBoardSettings.boardKey, runtime.settings.boardKey));
  } catch (error) {
    redirect(
      getManagePathWithFeedback(
        runtime.settings.clientId,
        runtime.settings.adminSlug,
        undefined,
        `Could not save board settings: ${error instanceof Error ? error.message : "unknown error"}`,
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

  await db
    .update(focusBoardSettings)
    .set({
      weeklyTarget: Math.max(1, getIntValue(formData, "weeklyTarget", runtime.settings.weeklyTarget)),
      weeklyRewardLabel: getValue(formData, "label") || runtime.weeklyReward.label,
      weeklyRewardLockedDescription:
        getValue(formData, "lockedDescription") || runtime.weeklyReward.lockedDescription,
      weeklyRewardUnlockedDescription:
        getValue(formData, "unlockedDescription") || runtime.weeklyReward.unlockedDescription,
      weeklyRewardLockedStickerSrc:
        getValue(formData, "lockedStickerSrc") || runtime.weeklyReward.lockedStickerSrc,
      weeklyRewardUnlockedStickerSrc:
        getValue(formData, "unlockedStickerSrc") || runtime.weeklyReward.unlockedStickerSrc,
      weeklyRewardStickerAlt: getValue(formData, "stickerAlt") || runtime.weeklyReward.stickerAlt,
    })
    .where(eq(focusBoardSettings.boardKey, runtime.settings.boardKey));

  revalidateFocusPaths(
    runtime.settings.boardSlug,
    runtime.settings.adminSlug,
    runtime.settings.clientId,
  );
  redirect(getManagePath(runtime.settings.clientId, runtime.settings.adminSlug));
}

export async function addFocusBoardSectionAction(formData: FormData) {
  const adminSlug = getValue(formData, "adminSlug");
  const runtime = await getAdminContext(adminSlug);
  const title = getValue(formData, "title");
  const description = getValue(formData, "description");

  if (!title) {
    throw new Error("Section name missing.");
  }

  const sectionKey = normaliseFocusKey(getValue(formData, "sectionKey") || title);
  try {
    await db.insert(focusBoardSections).values({
      boardKey: runtime.settings.boardKey,
      sectionKey,
      title,
      description,
      sortOrder: runtime.allSections.filter((section) => section.isActive !== false).length + 1,
    });
  } catch (error: unknown) {
    const dbError = error as { code?: string; message?: string };
    if (dbError.code === "23505") {
      throw new Error(`A section named "${title}" already exists.`);
    }
    throw new Error(dbError.message ?? "Unknown error");
  }

  revalidateFocusPaths(
    runtime.settings.boardSlug,
    runtime.settings.adminSlug,
    runtime.settings.clientId,
  );
}

export async function updateFocusBoardSectionAction(formData: FormData) {
  const adminSlug = getValue(formData, "adminSlug");
  const runtime = await getAdminContext(adminSlug);
  const sectionId = getValue(formData, "sectionId");
  const section = runtime.allSections.find((item) => item.id === sectionId);

  if (!section) {
    throw new Error("Section not found.");
  }

  await db
    .update(focusBoardSections)
    .set({
      title: getValue(formData, "title") || section.title,
      description: getValue(formData, "description"),
    })
    .where(and(eq(focusBoardSections.id, sectionId), eq(focusBoardSections.boardKey, runtime.settings.boardKey)));

  revalidateFocusPaths(
    runtime.settings.boardSlug,
    runtime.settings.adminSlug,
    runtime.settings.clientId,
  );
}

export async function reorderFocusBoardSectionsAction(formData: FormData) {
  const adminSlug = getValue(formData, "adminSlug");
  const runtime = await getAdminContext(adminSlug);
  const orderedSectionIds = formData
    .getAll("sectionIds")
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  const visibleSections = runtime.allSections.filter(
    (section) => section.isActive !== false && section.isVisible !== false,
  );
  const knownSectionIds = new Set(visibleSections.map((section) => section.id).filter(Boolean));

  if (orderedSectionIds.length !== visibleSections.length) {
    throw new Error("The section order is out of date. Refresh and try again.");
  }

  if (!orderedSectionIds.every((sectionId) => knownSectionIds.has(sectionId))) {
    throw new Error("One of those sections does not belong to this board.");
  }

  await Promise.all(
    orderedSectionIds.map((sectionId, index) =>
      db
        .update(focusBoardSections)
        .set({ sortOrder: index + 1 })
        .where(and(eq(focusBoardSections.id, sectionId), eq(focusBoardSections.boardKey, runtime.settings.boardKey))),
    ),
  );

  revalidateFocusPaths(
    runtime.settings.boardSlug,
    runtime.settings.adminSlug,
    runtime.settings.clientId,
  );
}

export async function toggleFocusBoardSectionVisibilityAction(formData: FormData) {
  const adminSlug = getValue(formData, "adminSlug");
  const runtime = await getAdminContext(adminSlug);
  const sectionId = getValue(formData, "sectionId");
  const nextVisible = getValue(formData, "nextVisible");
  const shouldShow = nextVisible === "true";
  const section = runtime.allSections.find((item) => item.id === sectionId);

  if (!section) {
    throw new Error("Section not found.");
  }

  const visibleSections = runtime.allSections.filter(
    (item) => item.isActive !== false && item.isVisible !== false,
  );
  await db
    .update(focusBoardSections)
    .set(
      shouldShow
        ? { isActive: true, isVisible: true, sortOrder: visibleSections.length + 1 }
        : { isVisible: false },
    )
    .where(and(eq(focusBoardSections.id, sectionId), eq(focusBoardSections.boardKey, runtime.settings.boardKey)));

  revalidateFocusPaths(
    runtime.settings.boardSlug,
    runtime.settings.adminSlug,
    runtime.settings.clientId,
  );
}

export async function addFocusBoardTaskAction(formData: FormData) {
  const adminSlug = getValue(formData, "adminSlug");
  const runtime = await getAdminContext(adminSlug);

  const title = getValue(formData, "title");
  const description = getValue(formData, "description");
  const metricLabel = getValue(formData, "metricLabel");
  const requestedSectionId = getValue(formData, "sectionId");
  const section = runtime.allSections.find(
    (item) => item.id === requestedSectionId && item.isActive !== false,
  ) ?? runtime.allSections.find((item) => item.isActive !== false);

  if (!title || !description || !metricLabel || !section?.id) {
    redirect(
      getManagePathWithChallengeFeedback(
        runtime.settings.clientId,
        runtime.settings.adminSlug,
        undefined,
        "New goals need a title, description, and metric label.",
      ),
    );
  }

  const currentSort = getActiveTaskCountForSection(runtime, section.id) + 1;
  const taskKey = normaliseFocusKey(getValue(formData, "taskKey") || title);
  const metricKey = normaliseFocusKey(getValue(formData, "metricKey") || metricLabel);
  const icon = (getValue(formData, "icon") || title.slice(0, 4)).toUpperCase().slice(0, 6);
  const stickerSrc = getValue(formData, "stickerSrc") || "/focus/mascot-rainbow.svg";
  const stickerAlt = getValue(formData, "stickerAlt") || `${title} sticker`;
  const accentClass = getAccentClassForIndex(runtime.allTasks.filter((task) => task.isActive !== false).length);
  const kind = getMetricKind(formData);
  const checkboxOptions = kind === "checkbox" ? getCheckboxOptions(formData) : [];
  const target = kind === "checkbox" ? checkboxOptions.length : Math.max(0, getIntValue(formData, "target", 1));
  const points = getIntValue(formData, "points", 1);

  let taskRow: { id: string } | undefined;
  try {
    const [inserted] = await db
      .insert(focusBoardTasks)
      .values({
        boardKey: runtime.settings.boardKey,
        sectionId: section.id,
        taskKey,
        icon,
        stickerSrc,
        stickerAlt,
        title,
        description,
        accentClass,
        sortOrder: currentSort,
      })
      .returning({ id: focusBoardTasks.id });
    taskRow = inserted;
  } catch (error: unknown) {
    const dbError = error as { code?: string; message?: string };
    const message =
      dbError.code === "23505"
        ? `A challenge with the key "${taskKey}" already exists. Try a more specific title.`
        : dbError.message ?? "Could not create the new goal.";

    redirect(
      getManagePathWithChallengeFeedback(
        runtime.settings.clientId,
        runtime.settings.adminSlug,
        undefined,
        message,
      ),
    );
  }

  if (!taskRow) {
    redirect(
      getManagePathWithChallengeFeedback(
        runtime.settings.clientId,
        runtime.settings.adminSlug,
        undefined,
        "Could not create the new goal.",
      ),
    );
  }

  try {
    await db.insert(focusBoardTaskMetrics).values({
      taskId: taskRow.id,
      metricKey,
      label: metricLabel,
      target,
      points,
      kind,
      checkboxOptions,
      sortOrder: 1,
    });
  } catch (metricError: unknown) {
    await db.delete(focusBoardTasks).where(and(eq(focusBoardTasks.id, taskRow.id), eq(focusBoardTasks.boardKey, runtime.settings.boardKey)));

    redirect(
      getManagePathWithChallengeFeedback(
        runtime.settings.clientId,
        runtime.settings.adminSlug,
        undefined,
        `Could not create the scoring metric: ${metricError instanceof Error ? metricError.message : "unknown error"}`,
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

  const taskId = getValue(formData, "taskId");
  if (!taskId) {
    throw new Error("Task id missing.");
  }
  const task = runtime.allTasks.find((item) => item.id === taskId);
  const requestedSectionId = getValue(formData, "sectionId");
  const nextSection = runtime.allSections.find(
    (section) => section.id === requestedSectionId && section.isActive !== false,
  );

  if (!task) {
    throw new Error("Task not found.");
  }

  const movedSection = Boolean(nextSection?.id && nextSection.id !== task.sectionId);

  await db
    .update(focusBoardTasks)
    .set({
      ...(movedSection && nextSection?.id
        ? {
            sectionId: nextSection.id,
            sortOrder: getActiveTaskCountForSection(runtime, nextSection.id) + 1,
          }
        : {}),
      title: getValue(formData, "title"),
      description: getValue(formData, "description"),
      icon: (getValue(formData, "icon") || "TASK").toUpperCase().slice(0, 6),
      stickerSrc: getValue(formData, "stickerSrc") || "/focus/mascot-rainbow.svg",
      stickerAlt: getValue(formData, "stickerAlt") || "Goal sticker",
      isBoosted: getValue(formData, "isBoosted") === "true",
    })
    .where(and(eq(focusBoardTasks.id, taskId), eq(focusBoardTasks.boardKey, runtime.settings.boardKey)));

  revalidateFocusPaths(
    runtime.settings.boardSlug,
    runtime.settings.adminSlug,
    runtime.settings.clientId,
  );
}

export async function reorderFocusBoardTasksAction(formData: FormData) {
  const adminSlug = getValue(formData, "adminSlug");
  const runtime = await getAdminContext(adminSlug);
  const sectionId = getValue(formData, "sectionId");
  const orderedTaskIds = formData
    .getAll("taskIds")
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  const visibleTasks = runtime.allTasks.filter(
    (task) => task.isActive !== false && task.isVisible !== false && task.sectionId === sectionId,
  );
  const knownTaskIds = new Set(visibleTasks.map((task) => task.id).filter(Boolean));

  if (orderedTaskIds.length !== visibleTasks.length) {
    throw new Error("The challenge order is out of date. Refresh and try again.");
  }

  if (!orderedTaskIds.every((taskId) => knownTaskIds.has(taskId))) {
    throw new Error("One of those challenges does not belong to this board.");
  }

  await Promise.all(
    orderedTaskIds.map((taskId, index) =>
      db
        .update(focusBoardTasks)
        .set({ sortOrder: index + 1 })
        .where(and(eq(focusBoardTasks.id, taskId), eq(focusBoardTasks.boardKey, runtime.settings.boardKey))),
    ),
  );

  revalidateFocusPaths(
    runtime.settings.boardSlug,
    runtime.settings.adminSlug,
    runtime.settings.clientId,
  );
}

export async function toggleFocusBoardTaskVisibilityAction(formData: FormData) {
  const adminSlug = getValue(formData, "adminSlug");
  const runtime = await getAdminContext(adminSlug);

  const taskId = getValue(formData, "taskId");
  const nextVisible = getValue(formData, "nextVisible");

  if (!taskId) {
    throw new Error("Task id missing.");
  }

  const shouldShow = nextVisible === "true";
  const task = runtime.allTasks.find((item) => item.id === taskId);

  if (!task?.sectionId) {
    throw new Error("Task section missing.");
  }

  const visibleTasksCount = getVisibleTaskCountForSection(runtime, task.sectionId);
  await db
    .update(focusBoardTasks)
    .set(
      shouldShow
        ? { isActive: true, isVisible: true, sortOrder: visibleTasksCount + 1 }
        : { isVisible: false },
    )
    .where(and(eq(focusBoardTasks.id, taskId), eq(focusBoardTasks.boardKey, runtime.settings.boardKey)));

  if (shouldShow) {
    await db
      .update(focusBoardTaskMetrics)
      .set({ isActive: true })
      .where(eq(focusBoardTaskMetrics.taskId, taskId));
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

  const taskId = getValue(formData, "taskId");
  if (!taskId) {
    throw new Error("Task id missing.");
  }

  await db
    .update(focusBoardTasks)
    .set({ isActive: false, isVisible: false })
    .where(and(eq(focusBoardTasks.id, taskId), eq(focusBoardTasks.boardKey, runtime.settings.boardKey)));

  await db
    .update(focusBoardTaskMetrics)
    .set({ isActive: false })
    .where(eq(focusBoardTaskMetrics.taskId, taskId));

  revalidateFocusPaths(
    runtime.settings.boardSlug,
    runtime.settings.adminSlug,
    runtime.settings.clientId,
  );
}

export async function addFocusBoardMetricAction(formData: FormData) {
  const adminSlug = getValue(formData, "adminSlug");
  const runtime = await getAdminContext(adminSlug);

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
  const kind = getMetricKind(formData);
  const checkboxOptions = kind === "checkbox" ? getCheckboxOptions(formData) : [];
  try {
    await db.insert(focusBoardTaskMetrics).values({
      taskId,
      metricKey,
      label: metricLabel,
      target: kind === "checkbox" ? checkboxOptions.length : Math.max(0, getIntValue(formData, "target", 0)),
      points: getIntValue(formData, "points", 1),
      kind,
      checkboxOptions,
      sortOrder: task.metrics.length + 1,
    });
  } catch (error: unknown) {
    const dbError = error as { code?: string; message?: string };
    if (dbError.code === "23505") {
      throw new Error(`A metric named "${metricLabel}" already exists in this goal.`);
    }
    throw new Error(dbError.message ?? "Unknown error");
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

  const kind = getMetricKind(formData);
  const checkboxOptions = kind === "checkbox" ? getCheckboxOptions(formData) : [];

  await db
    .update(focusBoardTaskMetrics)
    .set({
      label: getValue(formData, "label"),
      target: kind === "checkbox" ? checkboxOptions.length : Math.max(0, getIntValue(formData, "target", 0)),
      points: getIntValue(formData, "points", 0),
      kind,
      checkboxOptions,
    })
    .where(eq(focusBoardTaskMetrics.id, metricId));

  revalidateFocusPaths(
    runtime.settings.boardSlug,
    runtime.settings.adminSlug,
    runtime.settings.clientId,
  );
}

export async function toggleFocusBoardMetricVisibilityAction(formData: FormData) {
  const adminSlug = getValue(formData, "adminSlug");
  const runtime = await getAdminContext(adminSlug);

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
  const metricTask = runtime.allTasks.find((task) => task.metrics.some((metric) => metric.id === metricId));
  const visibleMetrics = metricTask?.metrics.filter(
    (metric) => metric.isActive !== false && metric.isVisible !== false,
  ) ?? [];
  await db
    .update(focusBoardTaskMetrics)
    .set(
      shouldShow
        ? { isActive: true, isVisible: true, sortOrder: visibleMetrics.length + 1 }
        : { isVisible: false },
    )
    .where(eq(focusBoardTaskMetrics.id, metricId));

  revalidateFocusPaths(
    runtime.settings.boardSlug,
    runtime.settings.adminSlug,
    runtime.settings.clientId,
  );
}

export async function deleteFocusBoardMetricAction(formData: FormData) {
  const adminSlug = getValue(formData, "adminSlug");
  const runtime = await getAdminContext(adminSlug);

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

  await db
    .update(focusBoardTaskMetrics)
    .set({ isActive: false })
    .where(eq(focusBoardTaskMetrics.id, metricId));

  revalidateFocusPaths(
    runtime.settings.boardSlug,
    runtime.settings.adminSlug,
    runtime.settings.clientId,
  );
}

export async function updateFocusRewardTierAction(formData: FormData) {
  const adminSlug = getValue(formData, "adminSlug");
  const runtime = await getAdminContext(adminSlug);

  const rewardId = getValue(formData, "rewardId");
  if (!rewardId) {
    throw new Error("Reward id missing.");
  }

  await db
    .update(focusBoardRewardTiers)
    .set({
      label: getValue(formData, "label"),
      description: getValue(formData, "description"),
      minPoints: Math.max(0, getIntValue(formData, "minPoints", 0)),
      minWeeksHit: Math.max(0, getIntValue(formData, "minWeeksHit", 0)),
      lockedStickerSrc: getValue(formData, "lockedStickerSrc"),
      unlockedStickerSrc: getValue(formData, "unlockedStickerSrc"),
      stickerAlt: getValue(formData, "stickerAlt"),
    })
    .where(and(eq(focusBoardRewardTiers.id, rewardId), eq(focusBoardRewardTiers.boardKey, runtime.settings.boardKey)));

  revalidateFocusPaths(
    runtime.settings.boardSlug,
    runtime.settings.adminSlug,
    runtime.settings.clientId,
  );
  redirect(getManagePath(runtime.settings.clientId, runtime.settings.adminSlug));
}
