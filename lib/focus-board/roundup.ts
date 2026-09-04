import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { focusBoardEvents, focusBoardWeeklyRoundups } from "@/lib/db/schema";
import { addMonths, getMonthStart, getPreviousWeekKey, getWeekStart, parseIsoDate, toIsoDate } from "@/lib/focus-board/dates";
import { getFocusBoardRuntimeConfigByBoardKey } from "@/lib/focus-board/runtime";

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
  const weekKey = getPreviousWeekKey();
  const rows = await db
    .select({ id: focusBoardWeeklyRoundups.id })
    .from(focusBoardWeeklyRoundups)
    .where(
      and(
        eq(focusBoardWeeklyRoundups.boardKey, boardKey),
        eq(focusBoardWeeklyRoundups.userId, userId),
        eq(focusBoardWeeklyRoundups.weekStart, weekKey),
      ),
    )
    .limit(1);

  return rows[0] ? null : { weekKey };
}

export async function markFocusWeeklyRoundupSeen(userId: string, boardKey: string, weekKey: string) {
  await db
    .insert(focusBoardWeeklyRoundups)
    .values({
      boardKey,
      userId,
      weekStart: weekKey,
      seenAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [focusBoardWeeklyRoundups.boardKey, focusBoardWeeklyRoundups.userId, focusBoardWeeklyRoundups.weekStart],
      set: { seenAt: new Date() },
    });
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

  const monthStart = getMonthStart(weekStart);
  const monthKey = toIsoDate(monthStart);
  const nextMonthKey = toIsoDate(addMonths(monthStart, 1));

  const [weekEvents, monthEvents, seenRows] = await Promise.all([
    db
      .select({ weekStart: focusBoardEvents.weekStart, taskKey: focusBoardEvents.taskKey, metricKey: focusBoardEvents.metricKey, points: focusBoardEvents.points })
      .from(focusBoardEvents)
      .where(and(eq(focusBoardEvents.boardKey, boardKey), eq(focusBoardEvents.weekStart, weekKey))),
    db
      .select({ weekStart: focusBoardEvents.weekStart, taskKey: focusBoardEvents.taskKey, metricKey: focusBoardEvents.metricKey, points: focusBoardEvents.points })
      .from(focusBoardEvents)
      .where(and(eq(focusBoardEvents.boardKey, boardKey), gte(focusBoardEvents.monthKey, monthKey), lt(focusBoardEvents.monthKey, nextMonthKey))),
    db
      .select({ id: focusBoardWeeklyRoundups.id, seenAt: focusBoardWeeklyRoundups.seenAt })
      .from(focusBoardWeeklyRoundups)
      .where(and(eq(focusBoardWeeklyRoundups.boardKey, boardKey), eq(focusBoardWeeklyRoundups.userId, userId), eq(focusBoardWeeklyRoundups.weekStart, weekKey)))
      .limit(1),
  ]);

  const seenRow = seenRows[0] ?? null;
  const weekPoints = weekEvents.reduce((sum, event) => sum + event.points, 0);
  const monthPoints = monthEvents.reduce((sum, event) => sum + event.points, 0);
  const monthWeekKeys = listMonthWeekKeys(monthStart);
  const monthWeekPointMap = new Map<string, number>();

  monthEvents.forEach((event) => {
    monthWeekPointMap.set(event.weekStart, (monthWeekPointMap.get(event.weekStart) ?? 0) + event.points);
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
      const taskEvents = weekEvents.filter((event) => event.taskKey === task.key);
      const metrics = task.metrics
        .map((metric) => {
          const metricEvents = taskEvents.filter(
            (event) => event.metricKey === metric.key || event.metricKey.startsWith(`${metric.key}:`),
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
        const taskEvents = weekEvents.filter((event) => event.taskKey === task.key);
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
