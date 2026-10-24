"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { FocusManagedClient } from "@/lib/focus-board/access";
import type { FocusBoardData } from "@/lib/focus-board/queries";

type DisplayBoard = {
  client: FocusManagedClient;
  board: FocusBoardData;
};

type Props = {
  boards: DisplayBoard[];
};

const POLL_INTERVAL_MS = 60_000;

const PRESET_COLORS: Record<string, string> = {
  neon: "#00f5d4",
  sunset_pop: "#ff8a5b",
  lagoon_bounce: "#63f2ff",
  citrus_blast: "#c6ff3f",
};
const FALLBACK_COLORS = ["#00f5d4", "#ff5db1", "#63f2ff", "#ffd84d"];

function personColors(boards: DisplayBoard[]) {
  const used = new Set<string>();
  return boards.map((b, i) => {
    let color = PRESET_COLORS[b.board.settings.themePreset] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]!;
    if (used.has(color)) color = FALLBACK_COLORS[i % FALLBACK_COLORS.length]!;
    used.add(color);
    return color;
  });
}

function shortName(name: string) {
  return name.replace(/['’]s Board$/i, "");
}

function formatWeekLabel(weekKey: string) {
  const date = new Date(weekKey + "T00:00:00Z");
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

function getWeeklyHype(points: number, target: number) {
  if (points >= target) return "NAILED IT";
  if (points >= target * 0.75) return "So close";
  if (points >= target * 0.45) return "Streak warming up";
  return "Tap the shiny things";
}

const CHART_W = 1600;
const CHART_H = 225;
const PAD = { left: 64, right: 96, top: 22, bottom: 46 };

function MonthlyChart({ boards, colors }: { boards: DisplayBoard[]; colors: string[] }) {
  if (boards.length === 0) return null;

  const weeks = boards[0]!.board.weeks;
  const weekKeys = weeks.map((w) => w.weekKey);
  const currentIdx = Math.max(0, weeks.findIndex((w) => w.isCurrent) === -1 ? weeks.length - 1 : weeks.findIndex((w) => w.isCurrent));
  const target = boards[0]!.board.weeklyTarget;

  const series = boards.map((b) => {
    let running = 0;
    return weekKeys.map((key, i) => {
      running += b.board.weeks.find((w) => w.weekKey === key)?.weekPoints ?? 0;
      return i <= currentIdx ? running : null;
    });
  });

  const maxCum = Math.max(0, ...series.flatMap((s) => s.filter((v): v is number => v !== null)));
  const paceNow = target * (currentIdx + 1);
  const yMax = Math.max(10, Math.ceil((Math.max(maxCum, paceNow) * 1.12) / 10) * 10);

  const plotW = CHART_W - PAD.left - PAD.right;
  const plotH = CHART_H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (weekKeys.length === 1 ? plotW / 2 : (i * plotW) / (weekKeys.length - 1));
  const y = (v: number) => PAD.top + plotH - (v / yMax) * plotH;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * yMax));
  const pacePoints = weekKeys
    .map((_, i) => (i <= currentIdx ? `${x(i)},${y(target * (i + 1))}` : null))
    .filter(Boolean)
    .join(" ");

  const endLabels = series
    .map((s, bi) => ({ bi, value: s[currentIdx] ?? 0 }))
    .sort((a, b) => a.value - b.value);
  const labelY = new Map<number, number>();
  let lastY = Infinity;
  for (const item of endLabels) {
    const ideal = y(item.value) + 6;
    const placed = Math.min(ideal, lastY - 30);
    labelY.set(item.bi, placed);
    lastY = placed;
  }

  return (
    <svg
      className="fdisplay-chart"
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      role="img"
      aria-label="Cumulative monthly points per person"
    >
      {ticks.map((t) => (
        <g key={t}>
          <line className="fdisplay-chart-grid" x1={PAD.left} x2={CHART_W - PAD.right} y1={y(t)} y2={y(t)} />
          <text className="fdisplay-chart-tick" x={PAD.left - 14} y={y(t) + 5} textAnchor="end">
            {t}
          </text>
        </g>
      ))}

      {pacePoints ? <polyline className="fdisplay-chart-pace" points={pacePoints} /> : null}

      {weekKeys.map((key, i) => (
        <text
          className={`fdisplay-chart-week ${i === currentIdx ? "fdisplay-chart-week-current" : ""}`}
          key={key}
          x={x(i)}
          y={CHART_H - 14}
          textAnchor="middle"
        >
          {formatWeekLabel(key)}
        </text>
      ))}

      {series.map((s, bi) => {
        const color = colors[bi]!;
        const points = s
          .map((v, i) => (v === null ? null : `${x(i)},${y(v)}`))
          .filter(Boolean)
          .join(" ");
        return (
          <g key={boards[bi]!.client.clientKey} style={{ color }}>
            <polyline className="fdisplay-chart-line" points={points} />
            {s.map((v, i) =>
              v === null ? null : (
                <circle
                  className="fdisplay-chart-dot"
                  cx={x(i)}
                  cy={y(v)}
                  key={i}
                  r={i === currentIdx ? 9 : 6}
                />
              ),
            )}
            <text
              className="fdisplay-chart-end"
              x={x(currentIdx) + 20}
              y={labelY.get(bi)}
            >
              {s[currentIdx] ?? 0}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

type WeekTask = NonNullable<DisplayBoard["board"]["currentWeek"]>["tasks"][number];

function TaskRow({ task, index }: { task: WeekTask; index: number }) {
  const totalCount = task.metrics.reduce((sum, m) => {
    if (m.kind === "checkbox") {
      return sum + (m.checkboxOptions ?? []).filter((o) => o.checked).length;
    }
    return sum + (m.count ?? 0);
  }, 0);

  const isDone = totalCount > 0;

  const metricSummary = task.metrics
    .map((m) => {
      if (m.kind === "checkbox") {
        const checked = (m.checkboxOptions ?? []).filter((o) => o.checked).length;
        const total = (m.checkboxOptions ?? []).length;
        if (total === 0 || checked === 0) return null;
        return `${checked}/${total}`;
      }
      const count = m.count ?? 0;
      if (count === 0) return null;
      return `×${count}`;
    })
    .filter(Boolean)
    .join(" · ");

  return (
    <li
      className={`fdisplay-task fdisplay-task-s${(index % 3) + 1} ${isDone ? "fdisplay-task-done" : ""}`}
    >
      <span className="fdisplay-task-badge">{isDone ? "✓" : ""}</span>
      <span className="fdisplay-task-title">{task.title}</span>
      {metricSummary ? <span className="fdisplay-task-count">{metricSummary}</span> : null}
    </li>
  );
}

function BoardCard({ client, board }: DisplayBoard) {
  const week = board.currentWeek;
  if (!week) return null;
  const pct = Math.min(100, Math.round((week.weekPoints / board.weeklyTarget) * 100));

  return (
    <article className={`fdisplay-card focus-theme-${board.settings.themePreset}`}>
      <header className="fdisplay-card-header">
        <div>
          <p className="fdisplay-card-kicker">{getWeeklyHype(week.weekPoints, board.weeklyTarget)}</p>
          <h2 className="fdisplay-card-name">{shortName(client.displayName)}</h2>
        </div>
        <p className="fdisplay-card-pts">
          <span className="fdisplay-pts-value">{week.weekPoints}</span>
          <span className="fdisplay-pts-target">/{board.weeklyTarget} pts</span>
        </p>
      </header>

      <div className="fdisplay-progress-bar">
        <div className="fdisplay-progress-fill" style={{ width: `${pct}%` }} />
      </div>

      <ul className="fdisplay-task-list">
        {week.tasks.map((task, i) => (
          <TaskRow index={i} key={task.key} task={task} />
        ))}
      </ul>
    </article>
  );
}

export function FamilyDisplay({ boards }: Props) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [router]);

  const firstBoard = boards[0]?.board;
  const monthLabel = firstBoard?.monthLabel ?? "";
  const weekKey = firstBoard?.currentWeek?.weekKey ?? "";
  const weekLabel = weekKey ? `Week of ${formatWeekLabel(weekKey)}` : "";
  const colors = personColors(boards);

  return (
    <div className="fdisplay-root">
      <header className="fdisplay-header">
        <div className="fdisplay-header-left">
          <span className="fdisplay-logo">FocusBoard</span>
          <span className="fdisplay-header-month">{monthLabel}</span>
          <span className="fdisplay-header-week">{weekLabel}</span>
        </div>
        <div className="fdisplay-legend">
          {boards.map((b, i) => (
            <span className="fdisplay-legend-item" key={b.client.clientKey}>
              <span className="fdisplay-legend-dot" style={{ background: colors[i], color: colors[i] }} />
              {shortName(b.client.displayName)}
            </span>
          ))}
        </div>
      </header>

      <section className="fdisplay-chart-section">
        <p className="fdisplay-chart-label">Points this month</p>
        <MonthlyChart boards={boards} colors={colors} />
      </section>

      <div className="fdisplay-boards" style={{ gridTemplateColumns: `repeat(${boards.length}, 1fr)` }}>
        {boards.map((b) => (
          <BoardCard board={b.board} client={b.client} key={b.client.clientKey} />
        ))}
      </div>
    </div>
  );
}
