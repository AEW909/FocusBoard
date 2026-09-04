import { unstable_noStore as noStore } from "next/cache";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { businessStatGroups, businessStatCategories, businessStatEntries } from "@/lib/db/schema";
import {
  addDays,
  getWeekStart,
  parseIsoDate,
  toIsoDate,
} from "@/lib/focus-board/dates";

export type BusinessStatUnit = "number" | "currency" | "percent";

export const BUSINESS_STAT_LINE_COLORS = [
  "#00f5d4",
  "#ff4dca",
  "#ffd84d",
  "#8f7cff",
  "#95ff4a",
  "#55a7ff",
  "#ff7a59",
  "#73e06c",
  "#ff8fb8",
  "#7ce6ff",
];

export type BusinessStatGroup = {
  id: string;
  clientId: string;
  name: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  isVisible: boolean;
};

export type BusinessStatCategory = {
  id: string;
  clientId: string;
  groupId: string | null;
  name: string;
  unit: BusinessStatUnit;
  prefix: string;
  suffix: string;
  color: string;
  weeklyTarget: number | null;
  monthlyTarget: number | null;
  sortOrder: number;
  isActive: boolean;
  isVisible: boolean;
};

export type BusinessStatEntry = {
  id: string;
  clientId: string;
  categoryId: string;
  weekStart: string;
  value: number;
};

export type BusinessStatsConfig = {
  groups: BusinessStatGroup[];
  visibleGroups: BusinessStatGroup[];
  categories: BusinessStatCategory[];
  visibleCategories: BusinessStatCategory[];
};

export type BusinessStatsData = BusinessStatsConfig & {
  entries: BusinessStatEntry[];
  collectionWeek: string;
  currentWeek: string;
  rangeStart: string;
  rangeEnd: string;
};

type GroupRow = typeof businessStatGroups.$inferSelect;
type CategoryRow = typeof businessStatCategories.$inferSelect;
type EntryRow = typeof businessStatEntries.$inferSelect;

function mapGroup(row: GroupRow): BusinessStatGroup {
  return {
    id: row.id,
    clientId: row.clientId,
    name: row.name,
    color: row.color,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    isVisible: row.isVisible,
  };
}

function mapCategory(row: CategoryRow): BusinessStatCategory {
  const weeklyTarget = row.weeklyTarget === null ? null : Number(row.weeklyTarget);
  const monthlyTarget =
    row.monthlyTarget === null
      ? weeklyTarget === null
        ? null
        : weeklyTarget * 4
      : Number(row.monthlyTarget);

  return {
    id: row.id,
    clientId: row.clientId,
    groupId: row.groupId,
    name: row.name,
    unit: row.unit as BusinessStatUnit,
    prefix: row.prefix,
    suffix: row.suffix,
    color: row.color,
    weeklyTarget,
    monthlyTarget,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    isVisible: row.isVisible,
  };
}

function mapEntry(row: EntryRow): BusinessStatEntry {
  return {
    id: row.id,
    clientId: row.clientId,
    categoryId: row.categoryId,
    weekStart: row.weekStart,
    value: Number(row.value),
  };
}

export function getDefaultBusinessStatsRange() {
  const currentWeekStart = getWeekStart();
  const rangeStart = addDays(currentWeekStart, -12 * 7);

  return {
    currentWeek: toIsoDate(currentWeekStart),
    rangeStart: toIsoDate(rangeStart),
    rangeEnd: toIsoDate(addDays(currentWeekStart, 7)),
  };
}

export function normaliseBusinessStatsWeek(value?: string | null) {
  const parsed = parseIsoDate(value);
  return toIsoDate(getWeekStart(parsed ?? new Date()));
}

export async function getBusinessStatsConfig(clientId: string): Promise<BusinessStatsConfig> {
  noStore();
  const [groupRows, categoryRows] = await Promise.all([
    db
      .select()
      .from(businessStatGroups)
      .where(eq(businessStatGroups.clientId, clientId))
      .orderBy(asc(businessStatGroups.sortOrder)),
    db
      .select()
      .from(businessStatCategories)
      .where(eq(businessStatCategories.clientId, clientId))
      .orderBy(asc(businessStatCategories.sortOrder)),
  ]);

  const groups = groupRows.map(mapGroup);
  const categories = categoryRows.map(mapCategory);

  return {
    groups,
    visibleGroups: groups.filter((group) => group.isActive !== false && group.isVisible !== false),
    categories,
    visibleCategories: categories.filter(
      (category) => category.isActive !== false && category.isVisible !== false,
    ),
  };
}

export async function getBusinessStatsData(
  clientId: string,
  params: { week?: string; start?: string; end?: string } = {},
): Promise<BusinessStatsData> {
  noStore();
  const config = await getBusinessStatsConfig(clientId);
  const defaults = getDefaultBusinessStatsRange();
  const rangeStart = parseIsoDate(params.start) ? normaliseBusinessStatsWeek(params.start) : defaults.rangeStart;
  const rangeEnd = parseIsoDate(params.end) ? normaliseBusinessStatsWeek(params.end) : defaults.rangeEnd;
  const collectionWeek = normaliseBusinessStatsWeek(params.week);

  const entryRows = await db
    .select()
    .from(businessStatEntries)
    .where(
      and(
        eq(businessStatEntries.clientId, clientId),
        gte(businessStatEntries.weekStart, rangeStart),
        lt(businessStatEntries.weekStart, rangeEnd),
      ),
    )
    .orderBy(asc(businessStatEntries.weekStart));

  return {
    ...config,
    entries: entryRows.map(mapEntry),
    collectionWeek,
    currentWeek: defaults.currentWeek,
    rangeStart,
    rangeEnd,
  };
}
