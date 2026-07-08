"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { saveBusinessStatsEntriesAction } from "@/app/clients/[clientId]/business/actions";
import type {
  BusinessStatCategory,
  BusinessStatEntry,
  BusinessStatGroup,
  BusinessStatUnit,
} from "@/lib/focus-board/business-stats";
import type { FocusThemePreset } from "@/lib/focus-board/config";

type FocusBusinessStatsProps = {
  backHref?: string;
  businessName: string;
  categories: BusinessStatCategory[];
  collectionWeek: string;
  currentWeek: string;
  clientId: string;
  entries: BusinessStatEntry[];
  groups: BusinessStatGroup[];
  rangeEnd: string;
  rangeStart: string;
  themePreset: FocusThemePreset;
};

type ReviewMode = "raw" | "rolling" | "change";
type ViewMode = "collect" | "review";

const SVG_WIDTH = 760;
const SVG_HEIGHT = 320;
const CHART_PADDING = {
  top: 24,
  right: 24,
  bottom: 46,
  left: 58,
};

function formatWeekLabel(weekKey: string) {
  const date = new Date(`${weekKey}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}

function formatNumber(value: number, unit: BusinessStatUnit, prefix: string, suffix: string) {
  const maximumFractionDigits = unit === "percent" ? 1 : value % 1 === 0 ? 0 : 1;
  const formatted = new Intl.NumberFormat("en-GB", {
    maximumFractionDigits,
  }).format(value);

  if (unit === "currency") {
    return `${prefix || "£"}${formatted}${suffix}`;
  }

  if (unit === "percent") {
    return `${prefix}${formatted}${suffix || "%"}`;
  }

  return `${prefix}${formatted}${suffix}`;
}

function addDays(weekKey: string, days: number) {
  const date = new Date(`${weekKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getWeekKeys(start: string, end: string) {
  const weeks: string[] = [];
  let cursor = start;

  while (cursor < end) {
    weeks.push(cursor);
    cursor = addDays(cursor, 7);
  }

  return weeks;
}

function getEntryMap(entries: BusinessStatEntry[]) {
  return new Map(entries.map((entry) => [`${entry.categoryId}:${entry.weekStart}`, entry]));
}

function getSeriesValues(
  category: BusinessStatCategory,
  weeks: string[],
  entryMap: Map<string, BusinessStatEntry>,
  mode: ReviewMode,
) {
  const rawValues = weeks.map((week) => entryMap.get(`${category.id}:${week}`)?.value ?? 0);

  if (mode === "raw") {
    return rawValues;
  }

  if (mode === "rolling") {
    return rawValues.map((_, index) => {
      const windowValues = rawValues.slice(Math.max(0, index - 3), index + 1);
      return windowValues.reduce((sum, value) => sum + value, 0) / windowValues.length;
    });
  }

  return rawValues.map((value, index) => {
    const previous = rawValues[index - 1] ?? 0;

    if (index === 0 || previous === 0) {
      return 0;
    }

    return ((value - previous) / previous) * 100;
  });
}

function getWeeklyGoalPace(category: BusinessStatCategory) {
  return category.monthlyTarget === null ? null : category.monthlyTarget / 4;
}

function buildLinePath(values: number[], minValue: number, maxValue: number) {
  const chartWidth = SVG_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const chartHeight = SVG_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
  const range = Math.max(maxValue - minValue, 1);

  return values
    .map((value, index) => {
      const x =
        CHART_PADDING.left +
        (values.length === 1 ? chartWidth / 2 : (index / (values.length - 1)) * chartWidth);
      const y = CHART_PADDING.top + chartHeight - ((value - minValue) / range) * chartHeight;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export function FocusBusinessStats({
  backHref,
  businessName,
  categories,
  clientId,
  collectionWeek,
  currentWeek,
  entries,
  groups,
  rangeEnd,
  rangeStart,
  themePreset,
}: FocusBusinessStatsProps) {
  const [view, setView] = useState<ViewMode>("collect");
  const [reviewMode, setReviewMode] = useState<ReviewMode>("raw");
  const [enabledGroupIds, setEnabledGroupIds] = useState(() => new Set(groups.map((group) => group.id)));
  const [enabledCategoryIds, setEnabledCategoryIds] = useState(
    () => new Set(categories.map((category) => category.id)),
  );
  const weeks = useMemo(() => getWeekKeys(rangeStart, rangeEnd), [rangeStart, rangeEnd]);
  const entryMap = useMemo(() => getEntryMap(entries), [entries]);
  const groupedCategories = useMemo(
    () =>
      groups.map((group) => ({
        group,
        categories: categories.filter((category) => category.groupId === group.id),
      })),
    [categories, groups],
  );
  const ungroupedCategories = categories.filter((category) => !category.groupId);
  const activeCategories = categories.filter((category) => {
    if (!enabledCategoryIds.has(category.id)) {
      return false;
    }

    if (!category.groupId) {
      return true;
    }

    return enabledGroupIds.has(category.groupId);
  });
  const series = activeCategories.map((category) => ({
    category,
    values: getSeriesValues(category, weeks, entryMap, reviewMode),
  }));
  const valuePool = series.flatMap((item) => item.values);
  const targets = reviewMode === "raw" ? activeCategories.flatMap((category) => getWeeklyGoalPace(category) ?? []) : [];
  const maxValue = Math.max(...valuePool, ...targets, 1);
  const minValue = reviewMode === "change" ? Math.min(...valuePool, 0) : 0;
  const yTicks = Array.from({ length: 4 }, (_, index) => {
    const share = index / 3;
    return minValue + (maxValue - minValue) * (1 - share);
  });

  const handleGroupToggle = (groupId: string) => {
    setEnabledGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleCategoryToggle = (categoryId: string) => {
    setEnabledCategoryIds((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  return (
    <main className={`focus-business-shell focus-public-page focus-public-page-neon focus-theme-${themePreset}`}>
      <div className="focus-business-container">
        <header className="focus-business-header">
          <div>
            <p className="focus-kicker">Business module</p>
            <h1>{businessName}</h1>
            <p>Collect weekly numbers, then review trends without leaving the board.</p>
          </div>
          {backHref ? (
            <Link className="focus-content-back-link" href={backHref}>
              Back to board
            </Link>
          ) : null}
        </header>

        <div className="focus-view-switch focus-view-switch-arcade">
          <button
            className={`focus-view-chip ${view === "collect" ? "focus-view-chip-active" : ""}`}
            onClick={() => setView("collect")}
            type="button"
          >
            Collect
          </button>
          <button
            className={`focus-view-chip ${view === "review" ? "focus-view-chip-active" : ""}`}
            onClick={() => setView("review")}
            type="button"
          >
            Review
          </button>
        </div>

        {categories.length === 0 ? (
          <section className="focus-business-empty">
            No visible stats have been configured yet.
          </section>
        ) : view === "collect" ? (
          <form action={saveBusinessStatsEntriesAction} className="focus-business-panel">
            <input name="clientId" type="hidden" value={clientId} />
            <div className="focus-business-panel-head">
              <div>
                <p className="focus-panel-label">Weekly collection</p>
                <h2>Week of {formatWeekLabel(collectionWeek)}</h2>
                <p>{collectionWeek === currentWeek ? "Current week" : "Backfill or edit a previous week"}</p>
              </div>
              <label className="field focus-business-week-field">
                <span>Collection week</span>
                <input name="weekStart" type="date" defaultValue={collectionWeek} />
              </label>
            </div>

            <div className="focus-business-collection-stack">
              {groupedCategories.map(({ group, categories: groupCategories }) =>
                groupCategories.length > 0 ? (
                  <section className="focus-business-group-card" key={group.id}>
                    <div className="focus-business-group-head">
                      <span style={{ background: group.color }} />
                      <h3>{group.name}</h3>
                    </div>
                    <div className="focus-business-input-grid">
                      {groupCategories.map((category) => {
                        const entry = entryMap.get(`${category.id}:${collectionWeek}`);

                        return (
                          <div className="focus-business-input-card" key={category.id}>
                            <label className="field">
                              <span>{category.name}</span>
                              <input
                                defaultValue={entry?.value ?? ""}
                                min={0}
                                name={`value:${category.id}`}
                                placeholder="0"
                                step="any"
                                type="number"
                              />
                            </label>
                            <label className="field">
                              <span>Note</span>
                              <input
                                defaultValue={entry?.note ?? ""}
                                name={`note:${category.id}`}
                                placeholder="Optional context"
                              />
                            </label>
                            {category.monthlyTarget !== null ? (
                              <p className="focus-business-target">
                                Monthly goal: {formatNumber(category.monthlyTarget, category.unit, category.prefix, category.suffix)}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : null,
              )}

              {ungroupedCategories.length > 0 ? (
                <section className="focus-business-group-card">
                  <div className="focus-business-group-head">
                    <span />
                    <h3>Ungrouped</h3>
                  </div>
                  <div className="focus-business-input-grid">
                    {ungroupedCategories.map((category) => {
                      const entry = entryMap.get(`${category.id}:${collectionWeek}`);

                      return (
                        <div className="focus-business-input-card" key={category.id}>
                          <label className="field">
                            <span>{category.name}</span>
                            <input
                              defaultValue={entry?.value ?? ""}
                              min={0}
                              name={`value:${category.id}`}
                              placeholder="0"
                              step="any"
                              type="number"
                            />
                          </label>
                          <label className="field">
                            <span>Note</span>
                            <input
                              defaultValue={entry?.note ?? ""}
                              name={`note:${category.id}`}
                              placeholder="Optional context"
                            />
                          </label>
                          {category.monthlyTarget !== null ? (
                            <p className="focus-business-target">
                              Monthly goal: {formatNumber(category.monthlyTarget, category.unit, category.prefix, category.suffix)}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}
            </div>

            <button className="button button-primary focus-business-save" type="submit">
              Save weekly stats
            </button>
          </form>
        ) : (
          <section className="focus-business-panel">
            <div className="focus-business-panel-head">
              <div>
                <p className="focus-panel-label">Trend review</p>
                <h2>Last three months</h2>
                <p>Toggle whole groups or individual stats to keep the graph readable.</p>
              </div>
              <div className="focus-business-mode-switch">
                {(["raw", "rolling", "change"] as const).map((mode) => (
                  <button
                    className={reviewMode === mode ? "is-active" : ""}
                    key={mode}
                    onClick={() => setReviewMode(mode)}
                    type="button"
                  >
                    {mode === "raw" ? "Raw/week" : mode === "rolling" ? "Rolling avg" : "% change"}
                  </button>
                ))}
              </div>
            </div>

            <div className="focus-business-review-layout">
              <aside className="focus-business-toggle-panel">
                <p className="focus-panel-label">Groups</p>
                <div className="focus-business-toggle-list">
                  {groups.map((group) => (
                    <button
                      className={enabledGroupIds.has(group.id) ? "is-active" : ""}
                      key={group.id}
                      onClick={() => handleGroupToggle(group.id)}
                      type="button"
                    >
                      <span style={{ background: group.color }} />
                      {group.name}
                    </button>
                  ))}
                </div>

                <p className="focus-panel-label">Stats</p>
                <div className="focus-business-toggle-list">
                  {categories.map((category) => (
                    <button
                      className={enabledCategoryIds.has(category.id) ? "is-active" : ""}
                      key={category.id}
                      onClick={() => handleCategoryToggle(category.id)}
                      type="button"
                    >
                      <span style={{ background: category.color }} />
                      {category.name}
                    </button>
                  ))}
                </div>
              </aside>

              <div className="focus-business-chart-card">
                <svg className="focus-business-chart" role="img" viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}>
                  <title>Business stats trend chart</title>
                  {yTicks.map((tick, index) => {
                    const y =
                      CHART_PADDING.top +
                      (index / 3) * (SVG_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom);

                    return (
                      <g key={tick.toFixed(2)}>
                        <line
                          stroke="rgba(255,255,255,0.12)"
                          strokeWidth="1"
                          x1={CHART_PADDING.left}
                          x2={SVG_WIDTH - CHART_PADDING.right}
                          y1={y}
                          y2={y}
                        />
                        <text fill="rgba(244,240,255,0.58)" fontSize="12" x="8" y={y + 4}>
                          {reviewMode === "change" ? `${Math.round(tick)}%` : Math.round(tick)}
                        </text>
                      </g>
                    );
                  })}

                  {reviewMode === "raw"
                    ? activeCategories.map((category) => {
                        const weeklyGoalPace = getWeeklyGoalPace(category);

                        if (weeklyGoalPace === null) {
                          return null;
                        }

                        const linePath = buildLinePath(
                          weeks.map(() => weeklyGoalPace),
                          minValue,
                          maxValue,
                        );

                        return (
                          <path
                            d={linePath}
                            fill="none"
                            key={`target:${category.id}`}
                            stroke={category.color}
                            strokeDasharray="8 8"
                            strokeOpacity="0.42"
                            strokeWidth="2"
                          />
                        );
                      })
                    : null}

                  {series.map(({ category, values }) => (
                    <path
                      d={buildLinePath(values, minValue, maxValue)}
                      fill="none"
                      key={category.id}
                      stroke={category.color}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="4"
                    />
                  ))}

                  {weeks.map((week, index) => {
                    const chartWidth = SVG_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
                    const x =
                      CHART_PADDING.left +
                      (weeks.length === 1 ? chartWidth / 2 : (index / (weeks.length - 1)) * chartWidth);

                    if (index % 2 !== 0 && index !== weeks.length - 1) {
                      return null;
                    }

                    return (
                      <text
                        fill="rgba(244,240,255,0.62)"
                        fontSize="12"
                        key={week}
                        textAnchor="middle"
                        x={x}
                        y={SVG_HEIGHT - 14}
                      >
                        {formatWeekLabel(week)}
                      </text>
                    );
                  })}
                </svg>

                <div className="focus-business-legend">
                  {activeCategories.map((category) => {
                    const latest = getSeriesValues(category, weeks, entryMap, reviewMode).at(-1) ?? 0;

                    return (
                      <div className="focus-business-legend-item" key={category.id}>
                        <span style={{ background: category.color }} />
                        <strong>{category.name}</strong>
                        <em>
                          {reviewMode === "change"
                            ? `${latest.toFixed(1)}%`
                            : formatNumber(latest, category.unit, category.prefix, category.suffix)}
                        </em>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
