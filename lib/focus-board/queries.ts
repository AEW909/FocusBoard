import { unstable_noStore as noStore } from "next/cache";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { focusBoardEvents } from "@/lib/db/schema";
import { getFocusBoardRuntimeConfigByBoardKey } from "@/lib/focus-board/runtime";
import {
  addDays,
  addMonths,
  getMonthStart,
  getWeekStart,
  parseIsoDate,
  toIsoDate,
} from "@/lib/focus-board/dates";

type FocusBoardParams = {
  history?: string;
  month?: string;
  week?: string;
};

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

  const events = await db
    .select({
      id: focusBoardEvents.id,
      boardKey: focusBoardEvents.boardKey,
      monthKey: focusBoardEvents.monthKey,
      weekStart: focusBoardEvents.weekStart,
      taskKey: focusBoardEvents.taskKey,
      metricKey: focusBoardEvents.metricKey,
      points: focusBoardEvents.points,
      createdAt: focusBoardEvents.createdAt,
    })
    .from(focusBoardEvents)
    .where(
      and(
        eq(focusBoardEvents.boardKey, runtime.settings.boardKey),
        gte(focusBoardEvents.monthKey, toIsoDate(queryStart)),
        lt(focusBoardEvents.monthKey, toIsoDate(queryEnd)),
      ),
    )
    .orderBy(asc(focusBoardEvents.createdAt));

  const counts = new Map<string, number>();
  const monthPointMap = new Map<string, number>();
  const selectedTaskPointMap = new Map<string, number>();
  const selectedSectionPointMap = new Map<string, number>();
  const weekPointMap = new Map<string, number>();
  const taskSectionMap = new Map(
    runtime.allTasks.map((task) => [
      task.key,
      {
        sectionKey: task.sectionKey ?? "main_goals",
        sectionTitle: task.sectionTitle ?? "Main goals",
      },
    ]),
  );

  events.forEach((event) => {
    const key = `${event.weekStart}:${event.taskKey}:${event.metricKey}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    monthPointMap.set(event.monthKey, (monthPointMap.get(event.monthKey) ?? 0) + event.points);
    weekPointMap.set(event.weekStart, (weekPointMap.get(event.weekStart) ?? 0) + event.points);

    if (event.monthKey === selectedMonthKey) {
      selectedTaskPointMap.set(event.taskKey, (selectedTaskPointMap.get(event.taskKey) ?? 0) + event.points);
      const section = taskSectionMap.get(event.taskKey);
      if (section) {
        selectedSectionPointMap.set(
          section.sectionKey,
          (selectedSectionPointMap.get(section.sectionKey) ?? 0) + event.points,
        );
      }
    }
  });

  const weeks = selectedWeekKeys.map((weekKey) => {
    const buildTask = (task: (typeof runtime.tasks)[number]) => {
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
    };
    const sections = runtime.sections
      .map((section) => ({
        ...section,
        tasks: section.tasks.map(buildTask),
      }))
      .filter((section) => section.tasks.length > 0);
    const tasks = sections.flatMap((section) => section.tasks);

    const weekPoints = weekPointMap.get(weekKey) ?? 0;

    return {
      weekKey,
      weekPoints,
      isCurrent: weekKey === currentWeekKey,
      isSelected: weekKey === selectedWeekKey,
      hitTarget: weekPoints >= runtime.settings.weeklyTarget,
      sections,
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
    sectionKey: task.sectionKey ?? "main_goals",
    sectionTitle: task.sectionTitle ?? "Main goals",
    title: task.title,
    accentClass: task.accentClass,
    points: selectedTaskPointMap.get(task.key) ?? 0,
  }));
  const sectionBreakdown = runtime.sections.map((section) => ({
    key: section.key,
    title: section.title,
    description: section.description,
    points: selectedSectionPointMap.get(section.key) ?? 0,
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
    sections: runtime.sections,
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
    sectionBreakdown: sectionBreakdown.filter((item) => item.points > 0 || runtime.sections.some((section) => section.key === item.key)),
    monthlyBreakdown: monthlyBreakdown.filter((item) => item.points > 0 || runtime.tasks.some((task) => task.key === item.key)),
    monthHistory,
  };
}

export type FocusBoardData = Awaited<ReturnType<typeof getFocusBoardData>>;
