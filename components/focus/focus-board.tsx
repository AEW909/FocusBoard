"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOutAction } from "@/app/login/actions";
import { updateFocusBoardAction, type UpdateFocusBoardState } from "@/app/focus/actions";
import { FocusImageWithFallback } from "@/components/focus/focus-image-with-fallback";
import type { FocusThemePreset } from "@/lib/focus-board/config";
import type { FocusBoardData } from "@/lib/focus-board/queries";

const initialState: UpdateFocusBoardState = {};

const FOCUS_THEME_PALETTES: Record<
  FocusThemePreset,
  {
    breakdownColors: string[];
    chartLine: string;
    currentDot: string;
    historyDot: string;
  }
> = {
  neon: {
    breakdownColors: ["#00f5d4", "#ffd84d", "#ff4dca", "#8f7cff", "#ff7a59", "#73e06c", "#55a7ff", "#ff8fb8"],
    chartLine: "#00f5d4",
    currentDot: "#95ff4a",
    historyDot: "#ff4dca",
  },
  sunset_pop: {
    breakdownColors: ["#ff8a5b", "#ffd166", "#ff5db1", "#a677ff", "#7ce6ff", "#ffb86b", "#83ff8f", "#ff7f7f"],
    chartLine: "#ff8a5b",
    currentDot: "#ffd166",
    historyDot: "#ff5db1",
  },
  lagoon_bounce: {
    breakdownColors: ["#63f2ff", "#6effc3", "#4f8dff", "#ff77cf", "#a7ff6f", "#71d0ff", "#ffd36a", "#9f7bff"],
    chartLine: "#63f2ff",
    currentDot: "#6effc3",
    historyDot: "#ff77cf",
  },
  citrus_blast: {
    breakdownColors: ["#c6ff3f", "#ffb703", "#ff7b54", "#72f1b8", "#ffe66d", "#ff5c8a", "#7cc7ff", "#b68cff"],
    chartLine: "#c6ff3f",
    currentDot: "#ffb703",
    historyDot: "#ff5c8a",
  },
};

type FocusBoardProps = {
  board: FocusBoardData;
  businessStatsEnabled: boolean;
  contentLabEnabled: boolean;
  initialView: "week" | "month";
  showInlineSignOut?: boolean;
};

type FocusView = "week" | "month";
type FocusMetricDirection = "add" | "remove";

type OptimisticMetricOperation = {
  id: string;
  slug: string;
  monthKey: string;
  weekKey: string;
  sectionKey: string;
  taskKey: string;
  metricKey: string;
  checkboxKey?: string;
  direction: FocusMetricDirection;
  points: number;
  status: "pending" | "confirmed";
};

function formatWeekLabel(weekKey: string) {
  const date = new Date(`${weekKey}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function getWeeklyHype(points: number, target: number) {
  if (points >= target) return "NAILED IT";
  if (points >= target * 0.75) return "So close";
  if (points >= target * 0.45) return "Streak warming up";
  return "Tap the shiny things";
}

function getMonthlyHype(weeksHit: number) {
  if (weeksHit >= 4) return "Absolute rocket month";
  if (weeksHit === 3) return "Serious boss glow";
  if (weeksHit === 2) return "Momentum is cooking";
  if (weeksHit === 1) return "First spark lit";
  return "One tiny win starts the chain";
}

function getRewardTone(points: number, target: number) {
  if (points >= target) return "focus-reward-bubble-victory";
  if (points >= target * 0.6) return "focus-reward-bubble-near";
  return "focus-reward-bubble-base";
}

function getTaskBurstText(progress: number, target: number) {
  if (target === 0) {
    return progress > 0 ? "BONUS BANKED" : "Bonus ready";
  }

  if (progress >= target) return "NAILED IT";
  if (progress > 0) return "Keep feeding the streak";
  return "Start here";
}

function buildWeekHref(boardSlug: string, monthKey: string, weekKey: string, view: FocusView) {
  return `/board/${boardSlug}?month=${monthKey}&week=${weekKey}&view=${view}`;
}

function buildMonthHref(boardSlug: string, monthKey: string, view: FocusView) {
  return `/board/${boardSlug}?month=${monthKey}&view=${view}`;
}

function buildHistoryHref(boardSlug: string, monthKey: string, historyEndKey: string) {
  return `/board/${boardSlug}?month=${monthKey}&history=${historyEndKey}&view=month`;
}

function buildLinePath(values: number[], width: number, height: number) {
  if (values.length === 0) {
    return "";
  }

  const maxValue = Math.max(...values, 1);

  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - (value / maxValue) * (height - 10) - 5;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function buildDonutSegments(values: { color: string; value: number }[], circumference: number) {
  const total = values.reduce((sum, item) => sum + item.value, 0);

  if (total <= 0) {
    return [];
  }

  let offset = 0;

  return values.map((item) => {
    const length = (item.value / total) * circumference;
    const segment = {
      color: item.color,
      dashArray: `${length} ${circumference - length}`,
      dashOffset: -offset,
    };

    offset += length;
    return segment;
  });
}

function getOptimisticOperationId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function applyOptimisticMetricOperations(
  board: FocusBoardData,
  operations: OptimisticMetricOperation[],
): FocusBoardData {
  if (operations.length === 0) {
    return board;
  }

  const pointDeltasByMonth = new Map<string, number>();
  const pointDeltasByTask = new Map<string, number>();
  const pointDeltasBySection = new Map<string, number>();

  const recordPointDelta = (operation: OptimisticMetricOperation, delta: number) => {
    if (delta === 0) {
      return;
    }

    pointDeltasByMonth.set(operation.monthKey, (pointDeltasByMonth.get(operation.monthKey) ?? 0) + delta);

    if (operation.monthKey === board.monthKey) {
      pointDeltasByTask.set(operation.taskKey, (pointDeltasByTask.get(operation.taskKey) ?? 0) + delta);
      pointDeltasBySection.set(
        operation.sectionKey,
        (pointDeltasBySection.get(operation.sectionKey) ?? 0) + delta,
      );
    }
  };

  const nextWeeks = board.weeks.map((week) => {
    let weekPointDelta = 0;
    const nextSections = week.sections.map((section) => ({
      ...section,
      tasks: section.tasks.map((task) => ({
        ...task,
        metrics: task.metrics.map((metric) => {
          const metricOperations = operations.filter(
            (operation) =>
              operation.weekKey === week.weekKey &&
              operation.taskKey === task.key &&
              operation.metricKey === metric.key,
          );

          if (metricOperations.length === 0) {
            return metric;
          }

          if (metric.kind === "checkbox") {
            const nextCheckboxOptions = (metric.checkboxOptions ?? []).map((option) => ({ ...option }));

            metricOperations.forEach((operation) => {
              const option = nextCheckboxOptions.find((item) => item.key === operation.checkboxKey);

              if (!option) {
                return;
              }

              if (operation.direction === "add" && !option.checked) {
                option.checked = true;
                weekPointDelta += operation.points;
                recordPointDelta(operation, operation.points);
              } else if (operation.direction === "remove" && option.checked) {
                option.checked = false;
                weekPointDelta -= operation.points;
                recordPointDelta(operation, -operation.points);
              }
            });

            return {
              ...metric,
              checkboxOptions: nextCheckboxOptions,
              count: nextCheckboxOptions.filter((option) => option.checked).length,
            };
          }

          let nextCount = metric.count;

          metricOperations.forEach((operation) => {
            if (operation.direction === "add") {
              nextCount += 1;
              weekPointDelta += operation.points;
              recordPointDelta(operation, operation.points);
            } else if (nextCount > 0) {
              nextCount -= 1;
              weekPointDelta -= operation.points;
              recordPointDelta(operation, -operation.points);
            }
          });

          return {
            ...metric,
            count: nextCount,
          };
        }),
      })),
    }));

    const weekPoints = Math.max(0, week.weekPoints + weekPointDelta);

    return {
      ...week,
      weekPoints,
      hitTarget: weekPoints >= board.weeklyTarget,
      sections: nextSections,
      tasks: nextSections.flatMap((section) => section.tasks),
    };
  });

  const monthPoints = Math.max(0, board.monthPoints + (pointDeltasByMonth.get(board.monthKey) ?? 0));
  const weeksHit = nextWeeks.filter((week) => week.hitTarget).length;
  const currentWeek = nextWeeks.find((week) => week.weekKey === board.currentWeek?.weekKey) ?? board.currentWeek;
  const currentReward =
    [...board.rewardTiers]
      .reverse()
      .find((tier) => monthPoints >= tier.minPoints && weeksHit >= tier.minWeeksHit) ?? null;
  const nextReward =
    board.rewardTiers.find((tier) => monthPoints < tier.minPoints || weeksHit < tier.minWeeksHit) ?? null;

  return {
    ...board,
    monthPoints,
    weeksHit,
    currentWeek,
    weeks: nextWeeks,
    currentReward,
    nextReward,
    monthlyBreakdown: board.monthlyBreakdown.map((item) => ({
      ...item,
      points: Math.max(0, item.points + (pointDeltasByTask.get(item.key) ?? 0)),
    })),
    sectionBreakdown: board.sectionBreakdown.map((item) => ({
      ...item,
      points: Math.max(0, item.points + (pointDeltasBySection.get(item.key) ?? 0)),
    })),
    monthHistory: board.monthHistory.map((month) => ({
      ...month,
      points: Math.max(0, month.points + (pointDeltasByMonth.get(month.monthKey) ?? 0)),
    })),
  };
}

export function FocusBoard({
  board: sourceBoard,
  businessStatsEnabled,
  contentLabEnabled,
  initialView,
  showInlineSignOut = false,
}: FocusBoardProps) {
  const router = useRouter();
  const [state, setState] = useState<UpdateFocusBoardState>(initialState);
  const [view, setView] = useState<FocusView>(initialView);
  const [, startTransition] = useTransition();
  const [optimisticOperations, setOptimisticOperations] = useState<OptimisticMetricOperation[]>([]);
  const [pendingCheckboxKeys, setPendingCheckboxKeys] = useState<Set<string>>(() => new Set());
  const pendingCheckboxLocksRef = useRef<Set<string>>(new Set());
  const board = useMemo(
    () => applyOptimisticMetricOperations(sourceBoard, optimisticOperations),
    [sourceBoard, optimisticOperations],
  );

  useEffect(() => {
    setOptimisticOperations((current) => current.filter((operation) => operation.status === "pending"));
    setPendingCheckboxKeys(new Set(pendingCheckboxLocksRef.current));
  }, [sourceBoard]);

  const themePalette =
    FOCUS_THEME_PALETTES[board.settings.themePreset] ?? FOCUS_THEME_PALETTES.neon;

  const currentWeek = board.currentWeek;
  const showSectionHeaders = (currentWeek?.sections.length ?? 0) > 1;
  const weeklyPrizeImageSrc = currentWeek?.hitTarget
    ? board.weeklyReward.unlockedStickerSrc
    : board.weeklyReward.lockedStickerSrc;
  const weeklyPercent = currentWeek
    ? clampPercent((currentWeek.weekPoints / board.weeklyTarget) * 100)
    : 0;
  const maxRewardPoints = board.rewardTiers.at(-1)?.minPoints ?? 1;
  const monthlyPercent = clampPercent((board.monthPoints / maxRewardPoints) * 100);

  const monthRewardCopy = useMemo(() => {
    if (board.currentReward) {
      return board.currentReward.label;
    }

    return "No monthly reward unlocked yet";
  }, [board.currentReward]);

  const totalBreakdownPoints = board.monthlyBreakdown.reduce((sum, item) => sum + item.points, 0);
  const totalSectionBreakdownPoints = board.sectionBreakdown.reduce((sum, item) => sum + item.points, 0);
  const sectionBreakdownItems = useMemo(
    () =>
      board.sectionBreakdown.map((item, index) => ({
        ...item,
        color:
          themePalette.breakdownColors[index % themePalette.breakdownColors.length],
      })),
    [board.sectionBreakdown, themePalette],
  );
  const breakdownItems = useMemo(
    () =>
      board.monthlyBreakdown.map((item, index) => ({
        ...item,
        color:
          themePalette.breakdownColors[index % themePalette.breakdownColors.length],
      })),
    [board.monthlyBreakdown, themePalette],
  );
  const pieSegments = useMemo(() => {
    if (totalBreakdownPoints === 0) {
      return [];
    }

    let cursor = 0;

    return breakdownItems
      .filter((item) => item.points > 0)
      .map((item) => {
        const share = item.points / totalBreakdownPoints;
        const from = cursor;
        const to = cursor + share * 360;
        cursor = to;
        return {
          ...item,
          from,
          to,
        };
      });
  }, [breakdownItems, totalBreakdownPoints]);

  const donutRadius = 44;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const donutSegments = buildDonutSegments(
    pieSegments.map((segment) => ({ color: segment.color, value: segment.points })),
    donutCircumference,
  );

  const lineValues = board.monthHistory.map((month) => month.points);
  const linePath = buildLinePath(lineValues, 280, 120);
  const historyRangeLabel = `${board.monthHistory[0]?.label ?? ""} - ${board.monthHistory.at(-1)?.label ?? ""}`;

  const contentLabHref = board.settings.clientId
    ? `/clients/${board.settings.clientId}/content`
    : `/focus-content/${board.settings.boardSlug}`;
  const businessStatsHref = board.settings.clientId
    ? `/clients/${board.settings.clientId}/business`
    : null;

  function handleMetricUpdate(operation: Omit<OptimisticMetricOperation, "id" | "slug" | "monthKey" | "status">) {
    const checkboxLockKey = operation.checkboxKey
      ? `${operation.weekKey}:${operation.taskKey}:${operation.metricKey}:${operation.checkboxKey}`
      : null;

    if (checkboxLockKey && pendingCheckboxLocksRef.current.has(checkboxLockKey)) {
      return;
    }

    const optimisticOperation: OptimisticMetricOperation = {
      ...operation,
      id: getOptimisticOperationId(),
      slug: board.settings.boardSlug,
      monthKey: board.monthKey,
      status: "pending",
    };
    const formData = new FormData();

    formData.set("slug", optimisticOperation.slug);
    formData.set("weekKey", optimisticOperation.weekKey);
    formData.set("monthKey", optimisticOperation.monthKey);
    formData.set("taskKey", optimisticOperation.taskKey);
    formData.set("metricKey", optimisticOperation.metricKey);
    formData.set("direction", optimisticOperation.direction);

    if (optimisticOperation.checkboxKey) {
      formData.set("checkboxKey", optimisticOperation.checkboxKey);
    }

    setState(initialState);
    setOptimisticOperations((current) => [...current, optimisticOperation]);

    if (checkboxLockKey) {
      pendingCheckboxLocksRef.current.add(checkboxLockKey);
      setPendingCheckboxKeys((current) => new Set(current).add(checkboxLockKey));
    }

    startTransition(() => {
      void updateFocusBoardAction(initialState, formData)
        .then((result) => {
          if (result.error) {
            setState(result);
            setOptimisticOperations((current) =>
              current.filter((item) => item.id !== optimisticOperation.id),
            );
            return;
          }

          setOptimisticOperations((current) =>
            current.map((item) =>
              item.id === optimisticOperation.id ? { ...item, status: "confirmed" } : item,
            ),
          );
          router.refresh();
        })
        .catch(() => {
          setState({ error: "That update could not be saved. Please try again." });
          setOptimisticOperations((current) =>
            current.filter((item) => item.id !== optimisticOperation.id),
          );
        })
        .finally(() => {
          if (checkboxLockKey) {
            pendingCheckboxLocksRef.current.delete(checkboxLockKey);
            setPendingCheckboxKeys((current) => {
              const next = new Set(current);
              next.delete(checkboxLockKey);
              return next;
            });
          }
        });
    });
  }

  return (
    <div className="focus-board-shell focus-board-shell-neon">
      <section className="focus-arcade-hero focus-arcade-hero-rebuilt">
        <div className="focus-hero-copy-wrap">
          {showInlineSignOut ? (
            <form action={signOutAction} className="focus-inline-signout-form">
              <button className="focus-inline-signout" type="submit">
                Sign out
              </button>
            </form>
          ) : null}
          <p className="focus-kicker">{board.settings.title}</p>
          <h1>{board.settings.subtitle}</h1>
          <p className="focus-hero-copy">
            This page exists to trick the nervous system into doing the boring growth jobs. Tap, score, collect, repeat.
          </p>
          <div className="focus-hero-badges">
            <span>Weekly target: {board.weeklyTarget} pts</span>
            <span>{board.weeksHit} weeks hit this month</span>
            <span>{board.monthPoints} points banked</span>
          </div>
          <div className="focus-module-launch-row">
            {contentLabEnabled ? (
              <a
                className="focus-content-launch-link"
                href={contentLabHref}
              >
                Open Content Lab
              </a>
            ) : null}
            {businessStatsEnabled && businessStatsHref ? (
              <a
                className="focus-content-launch-link"
                href={businessStatsHref}
              >
                Open Business Stats
              </a>
            ) : null}
          </div>
        </div>

        <div className="focus-hero-stickers">
          <img
            alt="Neon cheering mascot sticker"
            className="focus-hero-sticker focus-hero-sticker-main"
            src="/focus/mascot-rainbow.svg"
          />
          <img
            alt="Reward burst sticker"
            className="focus-hero-sticker focus-hero-sticker-float"
            src="/focus/reward-monster.svg"
          />
        </div>
      </section>

      <div className="focus-view-switch focus-view-switch-arcade">
        <button
          className={`focus-view-chip ${view === "week" ? "focus-view-chip-active" : ""}`}
          onClick={() => setView("week")}
          type="button"
        >
          This Week
        </button>
        <button
          className={`focus-view-chip ${view === "month" ? "focus-view-chip-active" : ""}`}
          onClick={() => setView("month")}
          type="button"
        >
          Monthly Rewards
        </button>
      </div>

      {state.error ? <p className="form-error">{state.error}</p> : null}

      {view === "week" && currentWeek ? (
        <div className="focus-scene">
          <section className="focus-score-splash">
            <div className="focus-week-nav">
              {board.navigation.previousWeekKey ? (
                <Link
                  aria-label="Show previous week"
                  className="focus-nav-arrow"
                  href={buildWeekHref(
                    board.settings.boardSlug,
                    board.navigation.previousWeekMonthKey,
                    board.navigation.previousWeekKey,
                    "week",
                  )}
                  scroll={false}
                >
                  &lt;
                </Link>
              ) : (
                <span className="focus-nav-arrow focus-nav-arrow-disabled">&lt;</span>
              )}

              <div className="focus-week-nav-copy">
                <p className="focus-panel-label">This week</p>
                <h2>Week of {formatWeekLabel(currentWeek.weekKey)}</h2>
                <p className="focus-week-edit-note">
                  {board.canEditSelectedWeek
                    ? "This week can be edited."
                    : "Future weeks are view-only until they arrive."}
                </p>
              </div>

              {board.navigation.nextWeekKey ? (
                board.navigation.canGoNextWeek ? (
                  <Link
                    aria-label="Show next week"
                    className="focus-nav-arrow"
                    href={buildWeekHref(
                      board.settings.boardSlug,
                      board.navigation.nextWeekMonthKey,
                      board.navigation.nextWeekKey,
                      "week",
                    )}
                    scroll={false}
                  >
                    &gt;
                  </Link>
                ) : (
                  <span className="focus-nav-arrow focus-nav-arrow-disabled">&gt;</span>
                )
              ) : (
                <span className="focus-nav-arrow focus-nav-arrow-disabled">&gt;</span>
              )}
            </div>

            <div className="focus-score-core">
              <div className="focus-score-ring">
                <div className="focus-score-ring-inner">
                  <strong>{currentWeek.weekPoints}</strong>
                  <span>points</span>
                </div>
              </div>
            </div>

            <div className={`focus-reward-bubble ${getRewardTone(currentWeek.weekPoints, board.weeklyTarget)}`}>
              <div className="focus-reward-bubble-layout">
                <div className="focus-reward-bubble-copy">
                  <p className="focus-panel-label">Immediate weekly reward</p>
                  <h3>{board.weeklyReward.label}</h3>
                  <p className="focus-reward-bubble-topline">{getWeeklyHype(currentWeek.weekPoints, board.weeklyTarget)}</p>
                  <p
                    className={`focus-reward-state ${
                      currentWeek.hitTarget ? "focus-reward-state-unlocked" : "focus-reward-state-locked"
                    }`}
                  >
                    {currentWeek.hitTarget
                      ? "Now unlocked"
                      : `${Math.max(board.weeklyTarget - currentWeek.weekPoints, 0)} points to go`}
                  </p>
                  <p className="focus-reward-bubble-main">
                    {currentWeek.hitTarget
                      ? board.weeklyReward.unlockedDescription
                      : board.weeklyReward.lockedDescription}
                  </p>
                  <div className="focus-progress-track focus-progress-track-fat">
                    <div className="focus-progress-fill" style={{ width: `${weeklyPercent}%` }} />
                  </div>
                </div>

                <div
                  className={`focus-reward-bubble-art ${
                    currentWeek.hitTarget ? "focus-reward-bubble-art-unlocked" : "focus-reward-bubble-art-locked"
                  }`}
                >
                  <FocusImageWithFallback
                    alt={board.weeklyReward.stickerAlt}
                    className="focus-reward-bubble-photo"
                    expandable
                    fallbackSrc={
                      currentWeek.hitTarget
                        ? board.weeklyReward.unlockedStickerFallbackSrc
                        : board.weeklyReward.lockedStickerFallbackSrc
                    }
                    src={weeklyPrizeImageSrc}
                  />
                </div>
              </div>
            </div>

            <button className="focus-scene-link" onClick={() => setView("month")} type="button">
              Jump to the monthly reward ladder
            </button>
          </section>

          <section className="focus-task-section-stack">
            {currentWeek.sections.map((section) => (
              <details className="focus-board-section" key={section.key}>
                <summary className="focus-board-section-head">
                  <div>
                    <p className="focus-panel-label">Goal area</p>
                    <h2>{section.title}</h2>
                    {section.description ? <p>{section.description}</p> : null}
                  </div>
                  <div className="focus-board-section-actions">
                    <span>{section.tasks.length} challenge{section.tasks.length === 1 ? "" : "s"}</span>
                    <span className="focus-board-section-toggle" aria-hidden="true" />
                  </div>
                </summary>
                <div className={showSectionHeaders ? "focus-board-section-body" : "focus-board-section-body focus-board-section-body-solo"}>
                  <div className="focus-task-reel">
                  {section.tasks.map((task) => (
                    <article
                      className={`focus-task-sticker ${task.accentClass} ${task.isBoosted ? "focus-task-sticker-boosted" : ""}`}
                      key={task.key}
                    >
                <div className="focus-task-sticker-top">
                  <div className="focus-task-sticker-copy">
                    <div className="focus-task-badge-row">
                      <div className="focus-task-chip">{task.icon}</div>
                      {task.isBoosted ? <span className="focus-task-boost-tag">Boosted x2</span> : null}
                    </div>
                    <h3>{task.title}</h3>
                    {!task.isActive ? <p className="focus-retired-tag">Retired challenge</p> : null}
                  </div>

                  <div className="focus-task-sticker-media">
                    <FocusImageWithFallback
                      alt={task.stickerAlt}
                      className="focus-task-sticker-image"
                      expandable
                      fallbackSrc={task.stickerFallbackSrc}
                      src={task.stickerSrc}
                    />
                  </div>

                  <details className="focus-help focus-help-sticker">
                    <summary aria-label={`About ${task.title}`}>?</summary>
                    <div className="focus-help-popover">{task.description}</div>
                  </details>
                </div>

                <div className="focus-metric-stack">
                  {task.metrics.map((metric) => {
                    const isCheckboxMetric = metric.kind === "checkbox";
                    const checkboxOptions = metric.checkboxOptions ?? [];
                    const metTarget = metric.target > 0 ? metric.count >= metric.target : metric.count > 0;
                    const metricPercent =
                      metric.target > 0 ? clampPercent((metric.count / metric.target) * 100) : metric.count > 0 ? 100 : 0;

                    return (
                      <div
                        className={`focus-metric-bubble ${isCheckboxMetric ? "focus-metric-bubble-checkbox" : ""}`}
                        key={metric.key}
                      >
                        <div className="focus-metric-copy">
                          <p className="focus-metric-label">{metric.label}</p>
                          <p className="focus-metric-meta">
                            {task.isBoosted ? `${metric.points * 2} boosted pts` : `${metric.points} pts`}{" "}
                            {isCheckboxMetric ? "per checkbox" : "each"}
                            {metric.target > 0 ? ` - target ${metric.target}` : " - bonus"}
                          </p>
                          <div className="focus-mini-bar">
                            <div className="focus-mini-bar-fill" style={{ width: `${metricPercent}%` }} />
                          </div>
                          <p className={`focus-mini-celebration ${metTarget ? "" : "focus-mini-celebration-soft"}`}>
                            {getTaskBurstText(metric.count, metric.target)}
                          </p>
                        </div>

                        {isCheckboxMetric ? (
                          <div className="focus-checkbox-grid">
                            {checkboxOptions.map((option) => {
                              const checkboxLockKey = `${currentWeek.weekKey}:${task.key}:${metric.key}:${option.key}`;
                              const checkboxPending = pendingCheckboxKeys.has(checkboxLockKey);

                              return (
                                <button
                                  className={`focus-checkbox-button ${option.checked ? "focus-checkbox-button-checked" : ""} ${
                                    checkboxPending ? "focus-checkbox-button-pending" : ""
                                  }`}
                                  disabled={
                                    checkboxPending ||
                                    !board.canEditSelectedWeek ||
                                    !task.isActive ||
                                    !metric.isActive
                                  }
                                  key={option.key}
                                  onClick={() =>
                                    handleMetricUpdate({
                                      weekKey: currentWeek.weekKey,
                                      sectionKey: section.key,
                                      taskKey: task.key,
                                      metricKey: metric.key,
                                      checkboxKey: option.key,
                                      direction: option.checked ? "remove" : "add",
                                      points: task.isBoosted ? metric.points * 2 : metric.points,
                                    })
                                  }
                                  type="button"
                                >
                                  <span className="focus-checkbox-indicator" aria-hidden="true">
                                    {option.checked ? "✓" : ""}
                                  </span>
                                  <span className="focus-checkbox-label">{option.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="focus-metric-controls focus-metric-controls-sticker">
                            <button
                              className="focus-icon-button"
                              disabled={metric.count === 0 || !board.canEditSelectedWeek || !task.isActive || !metric.isActive}
                              onClick={() =>
                                handleMetricUpdate({
                                  weekKey: currentWeek.weekKey,
                                  sectionKey: section.key,
                                  taskKey: task.key,
                                  metricKey: metric.key,
                                  direction: "remove",
                                  points: task.isBoosted ? metric.points * 2 : metric.points,
                                })
                              }
                              type="button"
                            >
                              -
                            </button>

                            <span className={`focus-metric-count ${metTarget ? "focus-metric-count-hit" : ""}`}>
                              {metric.count}
                            </span>

                            <button
                              className="focus-icon-button focus-icon-button-plus"
                              disabled={!board.canEditSelectedWeek || !task.isActive || !metric.isActive}
                              onClick={() =>
                                handleMetricUpdate({
                                  weekKey: currentWeek.weekKey,
                                  sectionKey: section.key,
                                  taskKey: task.key,
                                  metricKey: metric.key,
                                  direction: "add",
                                  points: task.isBoosted ? metric.points * 2 : metric.points,
                                })
                              }
                              type="button"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                    </article>
                  ))}
                  </div>
                </div>
              </details>
            ))}
          </section>

          <section className="focus-month-peek">
            <div className="focus-month-peek-copy">
              <p className="focus-panel-label">{board.monthLabel}</p>
              <h2>{board.monthPoints} total points</h2>
              <p>{getMonthlyHype(board.weeksHit)}</p>
            </div>
            <div className="focus-progress-track focus-progress-track-fat">
              <div className="focus-progress-fill focus-progress-fill-pink" style={{ width: `${monthlyPercent}%` }} />
            </div>
            <p className="focus-month-peek-reward">{monthRewardCopy}</p>
          </section>
        </div>
      ) : (
        <div className="focus-scene">
          <section className="focus-month-headline">
            <div className="focus-month-nav">
              <Link className="focus-nav-arrow" href={buildMonthHref(board.settings.boardSlug, board.navigation.previousMonthKey, "month")} scroll={false}>
                &lt;
              </Link>

              <div className="focus-month-nav-copy">
                <p className="focus-panel-label">Monthly rewards</p>
                <h2>{board.monthLabel}</h2>
                <p className="focus-hero-copy">The monthly prizes care about total points and how many weeks she actually hit the line.</p>
              </div>

              {board.navigation.nextMonthKey ? (
                <Link className="focus-nav-arrow" href={buildMonthHref(board.settings.boardSlug, board.navigation.nextMonthKey, "month")} scroll={false}>
                  &gt;
                </Link>
              ) : (
                <span className="focus-nav-arrow focus-nav-arrow-disabled">&gt;</span>
              )}
            </div>
            <img alt="Monthly reward monster sticker" className="focus-month-monster" src="/focus/reward-monster.svg" />
          </section>

          <section className="focus-month-progress">
            <div className="focus-month-progress-copy">
              <strong>{board.monthPoints} pts</strong>
              <span>{board.weeksHit} weekly wins hit</span>
            </div>
            <div className="focus-progress-track focus-progress-track-fat">
              <div className="focus-progress-fill focus-progress-fill-pink" style={{ width: `${monthlyPercent}%` }} />
            </div>
            <button className="focus-scene-link" onClick={() => setView("week")} type="button">
              Back to this week
            </button>
          </section>

          <section className="focus-win-strip focus-win-strip-sticker">
            {board.weeks.map((week) => (
              <div className={`focus-win-chip ${week.hitTarget ? "focus-win-chip-hit" : ""}`} key={week.weekKey}>
                <span>{formatWeekLabel(week.weekKey)}</span>
                <strong>{week.hitTarget ? "Hit!" : `${week.weekPoints} pts`}</strong>
              </div>
            ))}
          </section>

          <section className="focus-progress-snapshot">
            <div className="focus-progress-snapshot-head">
              <div>
                <p className="focus-panel-label">Progress snapshot</p>
                <h3>How the points stacked up</h3>
              </div>
              <div className="focus-chart-nav">
                <Link
                  aria-label="Show previous six months"
                  className="focus-nav-arrow"
                  href={buildHistoryHref(
                    board.settings.boardSlug,
                    board.monthKey,
                    board.navigation.previousHistoryEndKey,
                  )}
                  scroll={false}
                >
                  &lt;
                </Link>
                <span>{historyRangeLabel}</span>
                {board.navigation.nextHistoryEndKey ? (
                  <Link
                    aria-label="Show next six months"
                    className="focus-nav-arrow"
                    href={buildHistoryHref(
                      board.settings.boardSlug,
                      board.monthKey,
                      board.navigation.nextHistoryEndKey,
                    )}
                    scroll={false}
                  >
                    &gt;
                  </Link>
                ) : (
                  <span className="focus-nav-arrow focus-nav-arrow-disabled">&gt;</span>
                )}
              </div>
            </div>

            <div className="focus-progress-story">
              <div className="focus-line-chart-wrap">
                <svg aria-label="Monthly points chart" className="focus-line-chart" viewBox="0 0 280 120">
                  <path d="M0 115 H280" stroke="rgba(255,255,255,0.16)" strokeWidth="2" />
                  {linePath ? (
                    <>
                      <path
                        d={linePath}
                        fill="none"
                        stroke={themePalette.chartLine}
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {board.monthHistory.map((month, index) => {
                        const maxValue = Math.max(...lineValues, 1);
                        const x = board.monthHistory.length === 1 ? 140 : (index / (board.monthHistory.length - 1)) * 280;
                        const y = 120 - (month.points / maxValue) * 110 - 5;

                        return (
                          <circle
                            cx={x}
                            cy={y}
                            fill={month.isCurrent ? themePalette.currentDot : themePalette.historyDot}
                            key={month.monthKey}
                            r="5"
                          />
                        );
                      })}
                    </>
                  ) : null}
                </svg>
                <div className="focus-line-chart-labels">
                  {board.monthHistory.map((month) => (
                    <span key={month.monthKey}>{month.label}</span>
                  ))}
                </div>
              </div>

              <div className="focus-section-breakdown-card">
                <p className="focus-panel-label">By goal area</p>
                <div className="focus-section-breakdown-list">
                  {sectionBreakdownItems.map((item) => {
                    const share =
                      totalSectionBreakdownPoints > 0
                        ? Math.round((item.points / totalSectionBreakdownPoints) * 100)
                        : 0;

                    return (
                      <div className="focus-section-breakdown-item" key={item.key}>
                        <span className="focus-breakdown-dot" style={{ background: item.color }} />
                        <div>
                          <strong>{item.title}</strong>
                          <p>
                            {item.points} pts{share > 0 ? ` - ${share}%` : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="focus-breakdown-wrap">
                <div className="focus-breakdown-pie">
                  <svg aria-label="Monthly points breakdown" className="focus-breakdown-donut" viewBox="0 0 112 112">
                    <circle
                      cx="56"
                      cy="56"
                      fill="none"
                      r={donutRadius}
                      stroke="rgba(255,255,255,0.12)"
                      strokeWidth="18"
                    />
                    {donutSegments.map((segment, index) => (
                      <circle
                        cx="56"
                        cy="56"
                        fill="none"
                        key={`${segment.color}-${index}`}
                        r={donutRadius}
                        stroke={segment.color}
                        strokeDasharray={segment.dashArray}
                        strokeDashoffset={segment.dashOffset}
                        strokeLinecap="round"
                        strokeWidth="18"
                        transform="rotate(-90 56 56)"
                      />
                    ))}
                    <circle cx="56" cy="56" fill="rgba(10, 9, 20, 0.96)" r="28" />
                  </svg>
                </div>
                <div className="focus-breakdown-legend">
                  {breakdownItems.map((item) => {
                    const share = totalBreakdownPoints > 0 ? Math.round((item.points / totalBreakdownPoints) * 100) : 0;

                    return (
                      <div className="focus-breakdown-item" key={item.key}>
                        <span className="focus-breakdown-dot" style={{ background: item.color }} />
                        <div>
                          <strong>{item.title}</strong>
                          <p>
                            {item.points} pts{share > 0 ? ` - ${share}%` : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="focus-reward-zigzag">
            {board.rewardTiers.map((tier, index) => {
              const unlocked = board.monthPoints >= tier.minPoints && board.weeksHit >= tier.minWeeksHit;

              return (
                <article
                  className={`focus-month-tier focus-month-tier-zigzag ${unlocked ? "focus-month-tier-active" : ""} ${
                    index % 2 === 1 ? "focus-month-tier-offset" : ""
                  }`}
                  key={tier.label}
                >
                  <div className="focus-month-tier-sticker-wrap">
                    <div className={`focus-liona-reward-art focus-liona-reward-art-${index + 1}`}>
                      <FocusImageWithFallback
                        alt={tier.stickerAlt}
                        className="focus-liona-reward-photo"
                        expandable
                        fallbackSrc={unlocked ? tier.unlockedStickerFallbackSrc : tier.lockedStickerFallbackSrc}
                        src={unlocked ? tier.unlockedStickerSrc : tier.lockedStickerSrc}
                      />
                    </div>
                  </div>
                  <p className="focus-tier-points">
                    {tier.minPoints}+ pts - {tier.minWeeksHit} weeks hit
                  </p>
                  <h3>{tier.label}</h3>
                  <p>{tier.description}</p>
                  <span className="focus-tier-status">{unlocked ? "Unlocked" : "Locked"}</span>
                </article>
              );
            })}
          </section>
        </div>
      )}
    </div>
  );
}
