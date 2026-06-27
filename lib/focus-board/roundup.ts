import { createFocusBoardAdminClient } from "@/lib/focus-board/db";
import { addMonths, getMonthStart, getPreviousWeekKey, getWeekStart, parseIsoDate, toIsoDate } from "@/lib/focus-board/dates";
import { getFocusBoardRuntimeConfigByBoardKey } from "@/lib/focus-board/runtime";

type FocusBoardEventRow = {
  week_start: string;
  task_key: string;
  metric_key: string;
  points: number;
};

function listMonthWeekKeys(monthStart: Date) {
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

export async function getPendingFocusWeeklyRoundup(userId: string, boardKey: string) {
  const admin = createFocusBoardAdminClient();
  const weekKey = getPreviousWeekKey();
  const { data, error } = await admin
    .from("focus_board_weekly_roundups")
    .select("id")
    .eq("board_key", boardKey)
    .eq("user_id", userId)
    .eq("week_start", weekKey)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check weekly roundup state: ${error.message}`);
  }

  return data ? null : { weekKey };
}

export async function markFocusWeeklyRoundupSeen(userId: string, boardKey: string, weekKey: string) {
  const admin = createFocusBoardAdminClient();
  const { error } = await admin
    .from("focus_board_weekly_roundups")
    .upsert(
      {
        board_key: boardKey,
        user_id: userId,
        week_start: weekKey,
        seen_at: new Date().toISOString(),
      },
      { onConflict: "board_key,user_id,week_start" },
    );

  if (error) {
    throw new Error(`Failed to save weekly roundup state: ${error.message}`);
  }
}

export async function getFocusWeeklyRoundupData(boardKey: string, userId: string, weekKey: string) {
  const weekStart = parseIsoDate(weekKey);
  const currentWeekKey = toIsoDate(getWeekStart());

  if (!weekStart || weekKey >= currentWeekKey) {
    return null;
  }

  const runtime = await getFocusBoardRuntimeConfigByBoardKey(boardKey);
  if (!runtime) {
    return null;
  }

  const admin = createFocusBoardAdminClient();
  const monthStart = getMonthStart(weekStart);
  const monthKey = toIsoDate(monthStart);
  const nextMonthKey = toIsoDate(addMonths(monthStart, 1));
  const [{ data: weekRows, error: weekError }, { data: monthRows, error: monthError }, { data: seenRow, error: seenError }] =
    await Promise.all([
      admin
        .from("focus_board_events")
        .select("week_start, task_key, metric_key, points")
        .eq("board_key", boardKey)
        .eq("week_start", weekKey),
      admin
        .from("focus_board_events")
        .select("week_start, task_key, metric_key, points")
        .eq("board_key", boardKey)
        .gte("month_key", monthKey)
        .lt("month_key", nextMonthKey),
      admin
        .from("focus_board_weekly_roundups")
        .select("id, seen_at")
        .eq("board_key", boardKey)
        .eq("user_id", userId)
        .eq("week_start", weekKey)
        .maybeSingle(),
    ]);

  if (weekError) {
    throw new Error(`Failed to load weekly roundup: ${weekError.message}`);
  }

  if (monthError) {
    throw new Error(`Failed to load monthly roundup progress: ${monthError.message}`);
  }

  if (seenError) {
    throw new Error(`Failed to load weekly roundup state: ${seenError.message}`);
  }

  const weekEvents = (weekRows ?? []) as FocusBoardEventRow[];
  const monthEvents = (monthRows ?? []) as FocusBoardEventRow[];
  const weekPoints = weekEvents.reduce((sum, event) => sum + event.points, 0);
  const monthPoints = monthEvents.reduce((sum, event) => sum + event.points, 0);
  const monthWeekKeys = listMonthWeekKeys(monthStart);
  const monthWeekPointMap = new Map<string, number>();

  monthEvents.forEach((event) => {
    monthWeekPointMap.set(event.week_start, (monthWeekPointMap.get(event.week_start) ?? 0) + event.points);
  });

  const weeksHit = monthWeekKeys.filter((key) => (monthWeekPointMap.get(key) ?? 0) >= runtime.settings.weeklyTarget).length;
  const currentReward =
    [...runtime.rewards]
      .reverse()
      .find((tier) => monthPoints >= tier.minPoints && weeksHit >= tier.minWeeksHit) ?? null;
  const nextReward =
    runtime.rewards.find((tier) => monthPoints < tier.minPoints || weeksHit < tier.minWeeksHit) ?? null;

  const taskBreakdown = runtime.allTasks
    .map((task) => {
      const taskEvents = weekEvents.filter((event) => event.task_key === task.key);
      const metrics = task.metrics
        .map((metric) => {
          const metricEvents = taskEvents.filter(
            (event) => event.metric_key === metric.key || event.metric_key.startsWith(`${metric.key}:`),
          );

          return {
            key: metric.key,
            label: metric.label,
            count: metricEvents.length,
            points: metricEvents.reduce((sum, event) => sum + event.points, 0),
          };
        })
        .filter((metric) => metric.count > 0 || metric.points > 0);

      return {
        key: task.key,
        title: task.title,
        icon: task.icon,
        accentClass: task.accentClass,
        isBoosted: task.isBoosted,
        points: taskEvents.reduce((sum, event) => sum + event.points, 0),
        eventCount: taskEvents.length,
        metrics,
      };
    })
    .filter((task) => task.points > 0 || task.eventCount > 0);
  const sectionBreakdown = runtime.allSections
    .filter((section) => section.isActive !== false)
    .map((section) => {
      const points = section.tasks.reduce((sum, task) => {
        const taskEvents = weekEvents.filter((event) => event.task_key === task.key);
        return sum + taskEvents.reduce((taskSum, event) => taskSum + event.points, 0);
      }, 0);

      return {
        key: section.key,
        title: section.title,
        description: section.description,
        points,
      };
    })
    .filter((section) => section.points > 0);

  return {
    boardKey,
    settings: runtime.settings,
    weeklyReward: runtime.weeklyReward,
    rewardTiers: runtime.rewards,
    weekKey,
    monthKey,
    monthLabel: new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(monthStart),
    weekPoints,
    weeklyTarget: runtime.settings.weeklyTarget,
    hitTarget: weekPoints >= runtime.settings.weeklyTarget,
    pointsToTarget: Math.max(runtime.settings.weeklyTarget - weekPoints, 0),
    monthPoints,
    weeksHit,
    currentReward,
    nextReward,
    nextRewardPointsNeeded: nextReward ? Math.max(nextReward.minPoints - monthPoints, 0) : 0,
    nextRewardWeeksNeeded: nextReward ? Math.max(nextReward.minWeeksHit - weeksHit, 0) : 0,
    sectionBreakdown,
    taskBreakdown,
    hasSeen: Boolean(seenRow),
  };
}

export type FocusWeeklyRoundupData = NonNullable<Awaited<ReturnType<typeof getFocusWeeklyRoundupData>>>;
