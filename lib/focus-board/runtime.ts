import { unstable_noStore as noStore } from "next/cache";
import { getBundledFocusFallback } from "@/lib/focus-board/assets";
import { createFocusBoardAdminClient } from "@/lib/focus-board/db";
import {
  DEFAULT_FOCUS_BOARD_SETTINGS,
  DEFAULT_FOCUS_CHECKBOX_OPTIONS,
  DEFAULT_FOCUS_BOARD_TASKS,
  DEFAULT_FOCUS_REWARD_TIERS,
  DEFAULT_FOCUS_WEEKLY_REWARD,
  FOCUS_BOARD_ADMIN_SLUG,
  FOCUS_BOARD_SLUG,
  FOCUS_THEME_PRESETS,
  normaliseFocusCheckboxOptions,
  type FocusBoardSettings,
  type FocusBoardTask,
  type FocusBoardTaskMetric,
  type FocusCheckboxOption,
  type FocusThemePreset,
  type FocusRewardTier,
  type FocusWeeklyReward,
} from "@/lib/focus-board/config";

type FocusBoardSettingsRow = {
  client_id: string;
  board_key: string;
  board_slug: string;
  admin_slug: string;
  theme_preset: string;
  title: string;
  subtitle: string;
  weekly_target: number;
  weekly_reward_label: string;
  weekly_reward_description: string;
  weekly_reward_locked_description: string;
  weekly_reward_unlocked_description: string;
  weekly_reward_locked_sticker_src: string;
  weekly_reward_unlocked_sticker_src: string;
  weekly_reward_sticker_alt: string;
};

type FocusBoardTaskRow = {
  id: string;
  board_key: string;
  task_key: string;
  icon: string;
  sticker_src: string;
  sticker_alt: string;
  title: string;
  description: string;
  accent_class: string;
  sort_order: number;
  is_active: boolean;
  is_visible: boolean;
  is_boosted: boolean;
};

type FocusBoardTaskMetricRow = {
  id: string;
  task_id: string;
  metric_key: string;
  label: string;
  target: number;
  points: number;
  kind: FocusBoardTaskMetric["kind"];
  checkbox_options: unknown;
  sort_order: number;
  is_active: boolean;
  is_visible: boolean;
};

type FocusRewardTierRow = {
  id: string;
  board_key: string;
  label: string;
  min_points: number;
  min_weeks_hit: number;
  locked_sticker_src: string;
  unlocked_sticker_src: string;
  sticker_alt: string;
  description: string;
  sort_order: number;
};

export type FocusBoardRuntimeConfig = {
  settings: FocusBoardSettings;
  tasks: FocusBoardTask[];
  allTasks: FocusBoardTask[];
  rewards: FocusRewardTier[];
  weeklyReward: FocusWeeklyReward;
};

function mapSettings(row?: FocusBoardSettingsRow | null): FocusBoardSettings {
  if (!row) {
    return DEFAULT_FOCUS_BOARD_SETTINGS;
  }

  const themePreset = FOCUS_THEME_PRESETS.includes(row.theme_preset as FocusThemePreset)
    ? (row.theme_preset as FocusThemePreset)
    : DEFAULT_FOCUS_BOARD_SETTINGS.themePreset;

  return {
    clientId: row.client_id || null,
    boardKey: row.board_key || DEFAULT_FOCUS_BOARD_SETTINGS.boardKey,
    boardSlug: row.board_slug || FOCUS_BOARD_SLUG,
    adminSlug: row.admin_slug || FOCUS_BOARD_ADMIN_SLUG,
    themePreset,
    title: row.title || DEFAULT_FOCUS_BOARD_SETTINGS.title,
    subtitle: row.subtitle || DEFAULT_FOCUS_BOARD_SETTINGS.subtitle,
    weeklyTarget: row.weekly_target || DEFAULT_FOCUS_BOARD_SETTINGS.weeklyTarget,
  };
}

function mapWeeklyReward(row?: FocusBoardSettingsRow | null): FocusWeeklyReward {
  if (!row) {
    return DEFAULT_FOCUS_WEEKLY_REWARD;
  }

  return {
    label: row.weekly_reward_label || DEFAULT_FOCUS_WEEKLY_REWARD.label,
    lockedDescription:
      row.weekly_reward_locked_description || DEFAULT_FOCUS_WEEKLY_REWARD.lockedDescription,
    unlockedDescription:
      row.weekly_reward_unlocked_description ||
      row.weekly_reward_description ||
      DEFAULT_FOCUS_WEEKLY_REWARD.unlockedDescription,
    lockedStickerSrc: row.weekly_reward_locked_sticker_src || DEFAULT_FOCUS_WEEKLY_REWARD.lockedStickerSrc,
    lockedStickerFallbackSrc: getBundledFocusFallback(row.weekly_reward_locked_sticker_src),
    unlockedStickerSrc: row.weekly_reward_unlocked_sticker_src || DEFAULT_FOCUS_WEEKLY_REWARD.unlockedStickerSrc,
    unlockedStickerFallbackSrc: getBundledFocusFallback(row.weekly_reward_unlocked_sticker_src),
    stickerAlt: row.weekly_reward_sticker_alt || DEFAULT_FOCUS_WEEKLY_REWARD.stickerAlt,
  };
}

function mapTasks(taskRows: FocusBoardTaskRow[] | null, metricRows: FocusBoardTaskMetricRow[] | null) {
  if (!taskRows?.length) {
    return {
      tasks: DEFAULT_FOCUS_BOARD_TASKS,
      allTasks: DEFAULT_FOCUS_BOARD_TASKS,
    };
  }

  const metricsByTask = new Map<string, FocusBoardTaskMetric[]>();

  for (const row of metricRows ?? []) {
    const metrics = metricsByTask.get(row.task_id) ?? [];
    const parsedCheckboxOptions = normaliseFocusCheckboxOptions(
      Array.isArray(row.checkbox_options) ? (row.checkbox_options as FocusCheckboxOption[]) : [],
    );
    const checkboxOptions =
      row.kind === "checkbox" && parsedCheckboxOptions.length === 0
        ? DEFAULT_FOCUS_CHECKBOX_OPTIONS
        : parsedCheckboxOptions;

    metrics.push({
      id: row.id,
      key: row.metric_key,
      label: row.label,
      target: row.kind === "checkbox" ? checkboxOptions.length : row.target,
      points: row.points,
      kind: row.kind,
      checkboxOptions: row.kind === "checkbox" ? checkboxOptions : [],
      sortOrder: row.sort_order,
      isActive: row.is_active,
      isVisible: row.is_visible,
    });
    metricsByTask.set(row.task_id, metrics);
  }

  const allTasks = [...taskRows]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => ({
      id: row.id,
      key: row.task_key,
      icon: row.icon,
      stickerSrc: row.sticker_src,
      stickerFallbackSrc: getBundledFocusFallback(row.sticker_src),
      stickerAlt: row.sticker_alt,
      title: row.title,
      description: row.description,
      accentClass: row.accent_class,
      sortOrder: row.sort_order,
      isActive: row.is_active,
      isVisible: row.is_visible,
      isBoosted: row.is_boosted,
      metrics: (metricsByTask.get(row.id) ?? [])
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    }))
    .filter((task) => task.metrics.length > 0);

  return {
    allTasks,
    tasks: allTasks
      .filter((task) => task.isActive !== false && task.isVisible !== false)
      .map((task) => ({
        ...task,
        metrics: task.metrics.filter(
          (metric) => metric.isActive !== false && metric.isVisible !== false,
        ),
      }))
      .filter((task) => task.metrics.length > 0),
  };
}

function mapRewards(rows?: FocusRewardTierRow[] | null) {
  if (!rows?.length) {
    return DEFAULT_FOCUS_REWARD_TIERS;
  }

  return [...rows]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => ({
      id: row.id,
      label: row.label,
      minPoints: row.min_points,
      minWeeksHit: row.min_weeks_hit,
      lockedStickerSrc: row.locked_sticker_src,
      lockedStickerFallbackSrc: getBundledFocusFallback(row.locked_sticker_src),
      unlockedStickerSrc: row.unlocked_sticker_src,
      unlockedStickerFallbackSrc: getBundledFocusFallback(row.unlocked_sticker_src),
      stickerAlt: row.sticker_alt,
      description: row.description,
      sortOrder: row.sort_order,
    }));
}

type FocusBoardSettingsSelector = "board_key" | "board_slug" | "admin_slug" | "client_id";

async function getFocusBoardRuntimeConfigBy(
  selector: FocusBoardSettingsSelector,
  value: string,
): Promise<FocusBoardRuntimeConfig | null> {
  noStore();
  const admin = createFocusBoardAdminClient();

  const settingsResult = await admin
    .from("focus_board_settings")
    .select(
      "client_id, board_key, board_slug, admin_slug, theme_preset, title, subtitle, weekly_target, weekly_reward_label, weekly_reward_description, weekly_reward_locked_description, weekly_reward_unlocked_description, weekly_reward_locked_sticker_src, weekly_reward_unlocked_sticker_src, weekly_reward_sticker_alt",
    )
    .eq(selector, value)
    .maybeSingle<FocusBoardSettingsRow>();

  if (settingsResult.error || !settingsResult.data) {
    return null;
  }

  const settingsRow = settingsResult.data;
  const [tasksResult, rewardsResult] = await Promise.all([
    admin
      .from("focus_board_tasks")
      .select("id, board_key, task_key, icon, sticker_src, sticker_alt, title, description, accent_class, sort_order, is_active, is_visible, is_boosted")
      .eq("board_key", settingsRow.board_key)
      .order("sort_order", { ascending: true }),
    admin
      .from("focus_board_reward_tiers")
      .select(
        "id, board_key, label, min_points, min_weeks_hit, locked_sticker_src, unlocked_sticker_src, sticker_alt, description, sort_order",
      )
      .eq("board_key", settingsRow.board_key)
      .order("sort_order", { ascending: true }),
  ]);

  if (tasksResult.error || rewardsResult.error) {
    return null;
  }

  const taskRows = (tasksResult.data as FocusBoardTaskRow[] | null | undefined) ?? [];
  const taskIds = taskRows.map((task) => task.id);
  const metricsResult = taskIds.length
    ? await admin
        .from("focus_board_task_metrics")
        .select("id, task_id, metric_key, label, target, points, kind, checkbox_options, sort_order, is_active, is_visible")
        .in("task_id", taskIds)
        .order("sort_order", { ascending: true })
    : { data: [], error: null };

  if (metricsResult.error) {
    return null;
  }

  const settings = mapSettings(settingsRow);
  const weeklyReward = mapWeeklyReward(settingsRow);
  const taskConfig = mapTasks(
    taskRows,
    (metricsResult.data as FocusBoardTaskMetricRow[] | null | undefined) ?? null,
  );
  const rewards = mapRewards((rewardsResult.data as FocusRewardTierRow[] | null | undefined) ?? null);

  return {
    settings,
    tasks: taskConfig.tasks,
    allTasks: taskConfig.allTasks,
    rewards,
    weeklyReward,
  };
}

export async function getFocusBoardRuntimeConfigByBoardKey(boardKey: string) {
  return getFocusBoardRuntimeConfigBy("board_key", boardKey);
}

export async function getFocusBoardRuntimeConfigByPublicSlug(slug: string) {
  return getFocusBoardRuntimeConfigBy("board_slug", slug);
}

export async function getFocusBoardRuntimeConfigByAdminSlug(slug: string) {
  return getFocusBoardRuntimeConfigBy("admin_slug", slug);
}

export async function getFocusBoardRuntimeConfigByClientId(clientId: string) {
  return getFocusBoardRuntimeConfigBy("client_id", clientId);
}
