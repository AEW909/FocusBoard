import { unstable_noStore as noStore } from "next/cache";
import { getBundledFocusFallback } from "@/lib/focus-board/assets";
import { createFocusBoardAdminClient } from "@/lib/focus-board/db";
import {
  DEFAULT_FOCUS_BOARD_SETTINGS,
  DEFAULT_FOCUS_BOARD_TASKS,
  DEFAULT_FOCUS_REWARD_TIERS,
  DEFAULT_FOCUS_WEEKLY_REWARD,
  FOCUS_BOARD_ADMIN_SLUG,
  FOCUS_BOARD_KEY,
  FOCUS_BOARD_SLUG,
  type FocusBoardSettings,
  type FocusBoardTask,
  type FocusBoardTaskMetric,
  type FocusRewardTier,
  type FocusWeeklyReward,
} from "@/lib/focus-board/config";

type FocusBoardSettingsRow = {
  board_key: string;
  board_slug: string;
  admin_slug: string;
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
};

type FocusBoardTaskMetricRow = {
  id: string;
  task_id: string;
  metric_key: string;
  label: string;
  target: number;
  points: number;
  kind: FocusBoardTaskMetric["kind"];
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

function buildFallbackConfig(): FocusBoardRuntimeConfig {
  return {
    settings: DEFAULT_FOCUS_BOARD_SETTINGS,
    tasks: DEFAULT_FOCUS_BOARD_TASKS,
    allTasks: DEFAULT_FOCUS_BOARD_TASKS,
    rewards: DEFAULT_FOCUS_REWARD_TIERS,
    weeklyReward: DEFAULT_FOCUS_WEEKLY_REWARD,
  };
}

function mapSettings(row?: FocusBoardSettingsRow | null): FocusBoardSettings {
  if (!row) {
    return DEFAULT_FOCUS_BOARD_SETTINGS;
  }

  return {
    boardKey: row.board_key || FOCUS_BOARD_KEY,
    boardSlug: row.board_slug || FOCUS_BOARD_SLUG,
    adminSlug: row.admin_slug || FOCUS_BOARD_ADMIN_SLUG,
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
    metrics.push({
      id: row.id,
      key: row.metric_key,
      label: row.label,
      target: row.target,
      points: row.points,
      kind: row.kind,
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

export async function getFocusBoardRuntimeConfig(): Promise<FocusBoardRuntimeConfig> {
  noStore();
  const admin = createFocusBoardAdminClient();

  const [settingsResult, tasksResult, metricsResult, rewardsResult] = await Promise.all([
    admin
      .from("focus_board_settings")
      .select(
        "board_key, board_slug, admin_slug, title, subtitle, weekly_target, weekly_reward_label, weekly_reward_description, weekly_reward_locked_description, weekly_reward_unlocked_description, weekly_reward_locked_sticker_src, weekly_reward_unlocked_sticker_src, weekly_reward_sticker_alt",
      )
      .eq("board_key", FOCUS_BOARD_KEY)
      .maybeSingle<FocusBoardSettingsRow>(),
    admin
      .from("focus_board_tasks")
      .select("id, board_key, task_key, icon, sticker_src, sticker_alt, title, description, accent_class, sort_order, is_active, is_visible")
      .eq("board_key", FOCUS_BOARD_KEY)
      .order("sort_order", { ascending: true }),
    admin
      .from("focus_board_task_metrics")
      .select("id, task_id, metric_key, label, target, points, kind, sort_order, is_active, is_visible")
      .order("sort_order", { ascending: true }),
    admin
      .from("focus_board_reward_tiers")
      .select(
        "id, board_key, label, min_points, min_weeks_hit, locked_sticker_src, unlocked_sticker_src, sticker_alt, description, sort_order",
      )
      .eq("board_key", FOCUS_BOARD_KEY)
      .order("sort_order", { ascending: true }),
  ]);

  if (settingsResult.error || tasksResult.error || metricsResult.error || rewardsResult.error) {
    return buildFallbackConfig();
  }

  const settings = mapSettings((settingsResult.data as FocusBoardSettingsRow | null | undefined) ?? null);
  const weeklyReward = mapWeeklyReward((settingsResult.data as FocusBoardSettingsRow | null | undefined) ?? null);
  const taskConfig = mapTasks(
    (tasksResult.data as FocusBoardTaskRow[] | null | undefined) ?? null,
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

export async function getFocusBoardRuntimeConfigByPublicSlug(slug: string) {
  const config = await getFocusBoardRuntimeConfig();
  return config.settings.boardSlug === slug ? config : null;
}

export async function getFocusBoardRuntimeConfigByAdminSlug(slug: string) {
  const config = await getFocusBoardRuntimeConfig();
  return config.settings.adminSlug === slug ? config : null;
}
