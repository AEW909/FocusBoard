import { unstable_noStore as noStore } from "next/cache";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  focusBoardSettings,
  focusBoardSections,
  focusBoardTasks,
  focusBoardTaskMetrics,
  focusBoardRewardTiers,
} from "@/lib/db/schema";
import { getBundledFocusFallback } from "@/lib/focus-board/assets";
import {
  DEFAULT_FOCUS_BOARD_SETTINGS,
  DEFAULT_FOCUS_BOARD_SECTION,
  DEFAULT_FOCUS_CHECKBOX_OPTIONS,
  DEFAULT_FOCUS_BOARD_TASKS,
  DEFAULT_FOCUS_REWARD_TIERS,
  DEFAULT_FOCUS_WEEKLY_REWARD,
  FOCUS_BOARD_ADMIN_SLUG,
  FOCUS_BOARD_SLUG,
  FOCUS_THEME_PRESETS,
  normaliseFocusCheckboxOptions,
  type FocusBoardSettings,
  type FocusBoardSection,
  type FocusBoardTask,
  type FocusBoardTaskMetric,
  type FocusCheckboxOption,
  type FocusThemePreset,
  type FocusRewardTier,
  type FocusWeeklyReward,
} from "@/lib/focus-board/config";

export type FocusBoardRuntimeConfig = {
  settings: FocusBoardSettings;
  sections: FocusBoardSection[];
  allSections: FocusBoardSection[];
  tasks: FocusBoardTask[];
  allTasks: FocusBoardTask[];
  rewards: FocusRewardTier[];
  weeklyReward: FocusWeeklyReward;
};

type SettingsRow = typeof focusBoardSettings.$inferSelect;
type SectionRow = typeof focusBoardSections.$inferSelect;
type TaskRow = typeof focusBoardTasks.$inferSelect;
type MetricRow = typeof focusBoardTaskMetrics.$inferSelect;
type RewardRow = typeof focusBoardRewardTiers.$inferSelect;

function mapSettings(row?: SettingsRow | null): FocusBoardSettings {
  if (!row) {
    return DEFAULT_FOCUS_BOARD_SETTINGS;
  }

  const themePreset = FOCUS_THEME_PRESETS.includes(row.themePreset as FocusThemePreset)
    ? (row.themePreset as FocusThemePreset)
    : DEFAULT_FOCUS_BOARD_SETTINGS.themePreset;

  return {
    clientId: row.clientId || null,
    boardKey: row.boardKey || DEFAULT_FOCUS_BOARD_SETTINGS.boardKey,
    boardSlug: row.boardSlug || FOCUS_BOARD_SLUG,
    adminSlug: row.adminSlug || FOCUS_BOARD_ADMIN_SLUG,
    themePreset,
    title: row.title || DEFAULT_FOCUS_BOARD_SETTINGS.title,
    subtitle: row.subtitle || DEFAULT_FOCUS_BOARD_SETTINGS.subtitle,
    weeklyTarget: row.weeklyTarget || DEFAULT_FOCUS_BOARD_SETTINGS.weeklyTarget,
  };
}

function mapWeeklyReward(row?: SettingsRow | null): FocusWeeklyReward {
  if (!row) {
    return DEFAULT_FOCUS_WEEKLY_REWARD;
  }

  return {
    label: row.weeklyRewardLabel || DEFAULT_FOCUS_WEEKLY_REWARD.label,
    lockedDescription: row.weeklyRewardLockedDescription || DEFAULT_FOCUS_WEEKLY_REWARD.lockedDescription,
    unlockedDescription:
      row.weeklyRewardUnlockedDescription ||
      row.weeklyRewardDescription ||
      DEFAULT_FOCUS_WEEKLY_REWARD.unlockedDescription,
    lockedStickerSrc: row.weeklyRewardLockedStickerSrc || DEFAULT_FOCUS_WEEKLY_REWARD.lockedStickerSrc,
    lockedStickerFallbackSrc: getBundledFocusFallback(row.weeklyRewardLockedStickerSrc),
    unlockedStickerSrc: row.weeklyRewardUnlockedStickerSrc || DEFAULT_FOCUS_WEEKLY_REWARD.unlockedStickerSrc,
    unlockedStickerFallbackSrc: getBundledFocusFallback(row.weeklyRewardUnlockedStickerSrc),
    stickerAlt: row.weeklyRewardStickerAlt || DEFAULT_FOCUS_WEEKLY_REWARD.stickerAlt,
  };
}

function getDefaultSections(tasks = DEFAULT_FOCUS_BOARD_TASKS) {
  return [{ ...DEFAULT_FOCUS_BOARD_SECTION, tasks }];
}

function mapTasks(
  sectionRows: SectionRow[],
  taskRows: TaskRow[],
  metricRows: MetricRow[],
) {
  if (!taskRows.length) {
    const defaultSections = getDefaultSections(DEFAULT_FOCUS_BOARD_TASKS);
    return {
      sections: defaultSections,
      allSections: defaultSections,
      tasks: DEFAULT_FOCUS_BOARD_TASKS,
      allTasks: DEFAULT_FOCUS_BOARD_TASKS,
    };
  }

  const metricsByTask = new Map<string, FocusBoardTaskMetric[]>();

  for (const row of metricRows) {
    const metrics = metricsByTask.get(row.taskId) ?? [];
    const rawOptions = Array.isArray(row.checkboxOptions) ? (row.checkboxOptions as FocusCheckboxOption[]) : [];
    const parsedCheckboxOptions = normaliseFocusCheckboxOptions(rawOptions);
    const checkboxOptions =
      row.kind === "checkbox" && parsedCheckboxOptions.length === 0
        ? DEFAULT_FOCUS_CHECKBOX_OPTIONS
        : parsedCheckboxOptions;

    metrics.push({
      id: row.id,
      key: row.metricKey,
      label: row.label,
      target: row.kind === "checkbox" ? checkboxOptions.length : row.target,
      points: row.points,
      kind: row.kind as FocusBoardTaskMetric["kind"],
      checkboxOptions: row.kind === "checkbox" ? checkboxOptions : [],
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      isVisible: row.isVisible,
    });
    metricsByTask.set(row.taskId, metrics);
  }

  const sortedSectionRows = sectionRows.length
    ? [...sectionRows].sort((a, b) => a.sortOrder - b.sortOrder)
    : [
        {
          id: "",
          boardKey: "",
          sectionKey: DEFAULT_FOCUS_BOARD_SECTION.key,
          title: DEFAULT_FOCUS_BOARD_SECTION.title,
          description: DEFAULT_FOCUS_BOARD_SECTION.description,
          sortOrder: DEFAULT_FOCUS_BOARD_SECTION.sortOrder ?? 1,
          isActive: true,
          isVisible: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
  const fallbackSection = sortedSectionRows[0];
  const sectionById = new Map(sortedSectionRows.map((s) => [s.id, s]));
  const allTasks = [...taskRows]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row) => {
      const section = sectionById.get(row.sectionId ?? "") ?? fallbackSection;
      return {
        id: row.id,
        sectionId: section.id || null,
        sectionKey: section.sectionKey,
        sectionTitle: section.title,
        key: row.taskKey,
        icon: row.icon,
        stickerSrc: row.stickerSrc,
        stickerFallbackSrc: getBundledFocusFallback(row.stickerSrc),
        stickerAlt: row.stickerAlt,
        title: row.title,
        description: row.description,
        accentClass: row.accentClass,
        sortOrder: row.sortOrder,
        isActive: row.isActive,
        isVisible: row.isVisible,
        isBoosted: row.isBoosted,
        metrics: (metricsByTask.get(row.id) ?? []).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
      };
    })
    .filter((task) => task.metrics.length > 0);

  const activeVisibleTasks = allTasks
    .filter((task) => task.isActive !== false && task.isVisible !== false)
    .map((task) => ({
      ...task,
      metrics: task.metrics.filter((m) => m.isActive !== false && m.isVisible !== false),
    }))
    .filter((task) => task.metrics.length > 0);

  const allSections = sortedSectionRows
    .map((section) => ({
      id: section.id,
      key: section.sectionKey,
      title: section.title,
      description: section.description,
      sortOrder: section.sortOrder,
      isActive: section.isActive,
      isVisible: section.isVisible,
      tasks: allTasks.filter(
        (task) => task.sectionId === section.id || (!task.sectionId && section === fallbackSection),
      ),
    }))
    .filter((section) => section.isActive !== false);

  const sections = allSections
    .filter((section) => section.isVisible !== false)
    .map((section) => ({
      ...section,
      tasks: activeVisibleTasks.filter(
        (task) => task.sectionId === section.id || (!task.sectionId && section.id === fallbackSection.id),
      ),
    }))
    .filter((section) => section.tasks.length > 0);

  const tasks = sections.flatMap((section) => section.tasks);

  return { sections, allSections, allTasks, tasks };
}

function mapRewards(rows: RewardRow[]): FocusRewardTier[] {
  if (!rows.length) {
    return DEFAULT_FOCUS_REWARD_TIERS;
  }

  return [...rows]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row) => ({
      id: row.id,
      label: row.label,
      minPoints: row.minPoints,
      minWeeksHit: row.minWeeksHit,
      lockedStickerSrc: row.lockedStickerSrc,
      lockedStickerFallbackSrc: getBundledFocusFallback(row.lockedStickerSrc),
      unlockedStickerSrc: row.unlockedStickerSrc,
      unlockedStickerFallbackSrc: getBundledFocusFallback(row.unlockedStickerSrc),
      stickerAlt: row.stickerAlt,
      description: row.description,
      sortOrder: row.sortOrder,
    }));
}

async function getFocusBoardRuntimeConfigBy(
  selector: "boardKey" | "boardSlug" | "adminSlug" | "clientId",
  value: string,
): Promise<FocusBoardRuntimeConfig | null> {
  noStore();

  const condition =
    selector === "boardKey"
      ? eq(focusBoardSettings.boardKey, value)
      : selector === "boardSlug"
        ? eq(focusBoardSettings.boardSlug, value)
        : selector === "adminSlug"
          ? eq(focusBoardSettings.adminSlug, value)
          : eq(focusBoardSettings.clientId, value);

  const settingsRows = await db.select().from(focusBoardSettings).where(condition).limit(1);
  const settingsRow = settingsRows[0];

  if (!settingsRow) {
    return null;
  }

  const boardKey = settingsRow.boardKey;

  const [sectionRows, taskRows, rewardRows] = await Promise.all([
    db.select().from(focusBoardSections).where(eq(focusBoardSections.boardKey, boardKey)).orderBy(asc(focusBoardSections.sortOrder)),
    db.select().from(focusBoardTasks).where(eq(focusBoardTasks.boardKey, boardKey)).orderBy(asc(focusBoardTasks.sortOrder)),
    db.select().from(focusBoardRewardTiers).where(eq(focusBoardRewardTiers.boardKey, boardKey)).orderBy(asc(focusBoardRewardTiers.sortOrder)),
  ]);

  const taskIds = taskRows.map((t) => t.id);
  const metricRows = taskIds.length
    ? await db
        .select()
        .from(focusBoardTaskMetrics)
        .where(inArray(focusBoardTaskMetrics.taskId, taskIds))
        .orderBy(asc(focusBoardTaskMetrics.sortOrder))
    : [];

  const settings = mapSettings(settingsRow);
  const weeklyReward = mapWeeklyReward(settingsRow);
  const taskConfig = mapTasks(sectionRows, taskRows, metricRows);
  const rewards = mapRewards(rewardRows);

  return {
    settings,
    sections: taskConfig.sections,
    allSections: taskConfig.allSections,
    tasks: taskConfig.tasks,
    allTasks: taskConfig.allTasks,
    rewards,
    weeklyReward,
  };
}

export async function getFocusBoardRuntimeConfigByBoardKey(boardKey: string) {
  return getFocusBoardRuntimeConfigBy("boardKey", boardKey);
}

export async function getFocusBoardRuntimeConfigByPublicSlug(slug: string) {
  return getFocusBoardRuntimeConfigBy("boardSlug", slug);
}

export async function getFocusBoardRuntimeConfigByAdminSlug(slug: string) {
  return getFocusBoardRuntimeConfigBy("adminSlug", slug);
}

export async function getFocusBoardRuntimeConfigByClientId(clientId: string) {
  return getFocusBoardRuntimeConfigBy("clientId", clientId);
}
