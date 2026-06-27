import { unstable_noStore as noStore } from "next/cache";
import { createFocusBoardAdminClient } from "@/lib/focus-board/db";
import { getFocusBoardRuntimeConfigByBoardKey } from "@/lib/focus-board/runtime";

type FocusBoardEventRow = {
  id: string;
  board_key: string;
  month_key: string;
  week_start: string;
  task_key: string;
  metric_key: string;
  points: number;
  created_at: string;
};

type FocusBoardParams = {
  history?: string;
  month?: string;
  week?: string;
};

function getMonthStart(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getWeekStart(date = new Date()) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setUTCDate(copy.getUTCDate() + diff);
  return copy;
}

function parseIsoDate(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function listMonthWeeks(monthStart: Date) {
  const nextMonthStart = addMonths(monthStart, 1);
  const firstWeekStart = getWeekStart(monthStart);
  const weeks: string[] = [];
  const cursor = new Date(firstWeekStart);

  if (cursor < monthStart) {
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  while (cursor < nextMonthStart) {
    weeks.push(toIsoDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  return weeks;
}

function formatMonthLabel(monthKey: string) {
  const date = parseIsoDate(monthKey);

  if (!date) {
    return monthKey;
  }

  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function buildMonthHistory(historyEnd: Date, currentMonthKey: string, monthPointMap: Map<string, number>) {
  return Array.from({ length: 6 }, (_, index) => {
    const monthStart = addMonths(historyEnd, index - 5);
    const monthKey = toIsoDate(monthStart);

    return {
      monthKey,
      label: new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit" }).format(monthStart),
      points: monthPointMap.get(monthKey) ?? 0,
      isCurrent: monthKey === currentMonthKey,
    };
  });
}

export async function getFocusBoardData(
  boardKey: string,
  params: FocusBoardParams = {},
) {
  noStore();
  const admin = createFocusBoardAdminClient();
  const runtime = await getFocusBoardRuntimeConfigByBoardKey(boardKey);

  if (!runtime) {
    throw new Error("Focus board not found.");
  }
  const currentWeekStart = getWeekStart();
  const currentWeekKey = toIsoDate(currentWeekStart);
  const currentMonthStart = getMonthStart(currentWeekStart);
  const currentMonthKey = toIsoDate(currentMonthStart);

  const requestedMonthStart = parseIsoDate(params.month) ?? currentMonthStart;
  const selectedMonthStart = getMonthStart(requestedMonthStart);
  const selectedMonthKey = toIsoDate(selectedMonthStart);
  const requestedHistoryEnd = parseIsoDate(params.history);
  const historyEndStart =
    requestedHistoryEnd && requestedHistoryEnd <= currentMonthStart
      ? getMonthStart(requestedHistoryEnd)
      : currentMonthStart;
  const selectedWeekKeys = listMonthWeeks(selectedMonthStart);
  const requestedWeekKey = params.week && selectedWeekKeys.includes(params.week) ? params.week : undefined;
  const fallbackWeekKey =
    selectedMonthKey === currentMonthKey && selectedWeekKeys.includes(currentWeekKey)
      ? currentWeekKey
      : selectedWeekKeys.at(0) ?? currentWeekKey;
  const selectedWeekKey = requestedWeekKey ?? fallbackWeekKey;

  const monthHistoryStart = addMonths(historyEndStart, -5);
  const monthHistoryEnd = addMonths(historyEndStart, 1);
  const queryStart = monthHistoryStart < selectedMonthStart ? monthHistoryStart : selectedMonthStart;
  const selectedMonthEnd = addMonths(selectedMonthStart, 1);
  const queryEnd = monthHistoryEnd > selectedMonthEnd ? monthHistoryEnd : selectedMonthEnd;

  const { data, error } = await admin
    .from("focus_board_events")
    .select("id, board_key, month_key, week_start, task_key, metric_key, points, created_at")
    .eq("board_key", runtime.settings.boardKey)
    .gte("month_key", toIsoDate(queryStart))
    .lt("month_key", toIsoDate(queryEnd))
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load focus board: ${error.message}`);
  }

  const events = (data ?? []) as FocusBoardEventRow[];
  const counts = new Map<string, number>();
  const monthPointMap = new Map<string, number>();
  const selectedTaskPointMap = new Map<string, number>();
  const weekPointMap = new Map<string, number>();

  events.forEach((event) => {
    const key = `${event.week_start}:${event.task_key}:${event.metric_key}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    monthPointMap.set(event.month_key, (monthPointMap.get(event.month_key) ?? 0) + event.points);
    weekPointMap.set(event.week_start, (weekPointMap.get(event.week_start) ?? 0) + event.points);

    if (event.month_key === selectedMonthKey) {
      selectedTaskPointMap.set(event.task_key, (selectedTaskPointMap.get(event.task_key) ?? 0) + event.points);
    }
  });

  const weeks = selectedWeekKeys.map((weekKey) => {
    const tasks = runtime.tasks.map((task) => {
      const metrics = task.metrics.map((metric) => {
        if (metric.kind === "checkbox") {
          const checkboxOptions = (metric.checkboxOptions ?? []).map((option) => ({
            ...option,
            checked: (counts.get(`${weekKey}:${task.key}:${metric.key}:${option.key}`) ?? 0) > 0,
          }));

          return {
            ...metric,
            checkboxOptions,
            count: checkboxOptions.filter((option) => option.checked).length,
          };
        }

        const count = counts.get(`${weekKey}:${task.key}:${metric.key}`) ?? 0;
        return {
          ...metric,
          count,
        };
      });

      return {
        ...task,
        metrics,
      };
    });

    const weekPoints = weekPointMap.get(weekKey) ?? 0;

    return {
      weekKey,
      weekPoints,
      isCurrent: weekKey === currentWeekKey,
      isSelected: weekKey === selectedWeekKey,
      hitTarget: weekPoints >= runtime.settings.weeklyTarget,
      tasks,
    };
  });

  const monthPoints = monthPointMap.get(selectedMonthKey) ?? 0;
  const weeksHit = weeks.filter((week) => week.hitTarget).length;

  const currentReward =
    [...runtime.rewards]
      .reverse()
      .find((tier) => monthPoints >= tier.minPoints && weeksHit >= tier.minWeeksHit) ?? null;

  const nextReward =
    runtime.rewards.find((tier) => monthPoints < tier.minPoints || weeksHit < tier.minWeeksHit) ?? null;

  const selectedWeek = weeks.find((week) => week.weekKey === selectedWeekKey) ?? weeks[0];
  const selectedWeekStart = parseIsoDate(selectedWeekKey) ?? getWeekStart();
  const previousWeekKey = toIsoDate(addDays(selectedWeekStart, -7));
  const nextWeekKey = toIsoDate(addDays(selectedWeekStart, 7));
  const previousWeekMonthKey = toIsoDate(getMonthStart(parseIsoDate(previousWeekKey) ?? selectedWeekStart));
  const nextWeekMonthKey = toIsoDate(getMonthStart(parseIsoDate(nextWeekKey) ?? selectedWeekStart));
  const canEditSelectedWeek = selectedWeek ? selectedWeek.weekKey <= currentWeekKey : false;
  const canGoNextWeek = nextWeekKey <= currentWeekKey;
  const previousMonthKey = toIsoDate(addMonths(selectedMonthStart, -1));
  const nextMonthKey = selectedMonthKey < currentMonthKey ? toIsoDate(addMonths(selectedMonthStart, 1)) : null;
  const previousHistoryEndKey = toIsoDate(addMonths(historyEndStart, -6));
  const nextHistoryCandidate = addMonths(historyEndStart, 6);
  const nextHistoryEndKey =
    historyEndStart < currentMonthStart
      ? toIsoDate(nextHistoryCandidate > currentMonthStart ? currentMonthStart : nextHistoryCandidate)
      : null;

  const monthlyBreakdown = runtime.tasks.map((task) => ({
    key: task.key,
    title: task.title,
    accentClass: task.accentClass,
    points: selectedTaskPointMap.get(task.key) ?? 0,
  }));

  const monthHistory = buildMonthHistory(historyEndStart, currentMonthKey, monthPointMap);

  return {
    boardKey: runtime.settings.boardKey,
    monthKey: selectedMonthKey,
    monthLabel: formatMonthLabel(selectedMonthKey),
    currentMonthKey,
    currentWeekKey,
    monthPoints,
    weeksHit,
    weeklyTarget: runtime.settings.weeklyTarget,
    currentWeek: selectedWeek,
    weeks,
    currentReward,
    nextReward,
    canEditSelectedWeek,
    settings: runtime.settings,
    weeklyReward: runtime.weeklyReward,
    rewardTiers: runtime.rewards,
    navigation: {
      selectedWeekKey,
      previousWeekKey,
      previousWeekMonthKey,
      nextWeekKey,
      nextWeekMonthKey,
      canGoNextWeek,
      previousMonthKey,
      nextMonthKey,
      previousHistoryEndKey,
      nextHistoryEndKey,
    },
    monthlyBreakdown: monthlyBreakdown.filter((item) => item.points > 0 || runtime.tasks.some((task) => task.key === item.key)),
    monthHistory,
  };
}

export type FocusBoardData = Awaited<ReturnType<typeof getFocusBoardData>>;
