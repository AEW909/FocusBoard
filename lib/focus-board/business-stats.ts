import { unstable_noStore as noStore } from "next/cache";
import { createFocusBoardAdminClient } from "@/lib/focus-board/db";
import {
  addDays,
  getWeekStart,
  parseIsoDate,
  toIsoDate,
} from "@/lib/focus-board/dates";

export type BusinessStatUnit = "number" | "currency" | "percent";

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
  note: string;
};

type GroupRow = {
  id: string;
  client_id: string;
  name: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  is_visible: boolean;
};

type CategoryRow = {
  id: string;
  client_id: string;
  group_id: string | null;
  name: string;
  unit: BusinessStatUnit;
  prefix: string;
  suffix: string;
  color: string;
  weekly_target: number | null;
  sort_order: number;
  is_active: boolean;
  is_visible: boolean;
};

type EntryRow = {
  id: string;
  client_id: string;
  category_id: string;
  week_start: string;
  value: number;
  note: string;
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

function mapGroup(row: GroupRow): BusinessStatGroup {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    isVisible: row.is_visible,
  };
}

function mapCategory(row: CategoryRow): BusinessStatCategory {
  return {
    id: row.id,
    clientId: row.client_id,
    groupId: row.group_id,
    name: row.name,
    unit: row.unit,
    prefix: row.prefix,
    suffix: row.suffix,
    color: row.color,
    weeklyTarget: row.weekly_target === null ? null : Number(row.weekly_target),
    sortOrder: row.sort_order,
    isActive: row.is_active,
    isVisible: row.is_visible,
  };
}

function mapEntry(row: EntryRow): BusinessStatEntry {
  return {
    id: row.id,
    clientId: row.client_id,
    categoryId: row.category_id,
    weekStart: row.week_start,
    value: Number(row.value),
    note: row.note,
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
  const admin = createFocusBoardAdminClient();
  const [groupsResult, categoriesResult] = await Promise.all([
    admin
      .from("business_stat_groups")
      .select("id, client_id, name, color, sort_order, is_active, is_visible")
      .eq("client_id", clientId)
      .order("sort_order", { ascending: true }),
    admin
      .from("business_stat_categories")
      .select("id, client_id, group_id, name, unit, prefix, suffix, color, weekly_target, sort_order, is_active, is_visible")
      .eq("client_id", clientId)
      .order("sort_order", { ascending: true }),
  ]);

  if (groupsResult.error) {
    throw new Error(`Failed to load business stat groups: ${groupsResult.error.message}`);
  }

  if (categoriesResult.error) {
    throw new Error(`Failed to load business stat categories: ${categoriesResult.error.message}`);
  }

  const groups = ((groupsResult.data ?? []) as GroupRow[]).map(mapGroup);
  const categories = ((categoriesResult.data ?? []) as CategoryRow[]).map(mapCategory);

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
  const admin = createFocusBoardAdminClient();
  const config = await getBusinessStatsConfig(clientId);
  const defaults = getDefaultBusinessStatsRange();
  const rangeStart = parseIsoDate(params.start) ? normaliseBusinessStatsWeek(params.start) : defaults.rangeStart;
  const rangeEnd = parseIsoDate(params.end) ? normaliseBusinessStatsWeek(params.end) : defaults.rangeEnd;
  const collectionWeek = normaliseBusinessStatsWeek(params.week);

  const { data, error } = await admin
    .from("business_stat_entries")
    .select("id, client_id, category_id, week_start, value, note")
    .eq("client_id", clientId)
    .gte("week_start", rangeStart)
    .lt("week_start", rangeEnd)
    .order("week_start", { ascending: true });

  if (error) {
    throw new Error(`Failed to load business stat entries: ${error.message}`);
  }

  return {
    ...config,
    entries: ((data ?? []) as EntryRow[]).map(mapEntry),
    collectionWeek,
    currentWeek: defaults.currentWeek,
    rangeStart,
    rangeEnd,
  };
}
