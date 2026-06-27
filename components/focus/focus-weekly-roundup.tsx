"use client";

import { useEffect, useMemo, useState } from "react";
import { completeFocusWeeklyRoundupAction } from "@/app/board/[slug]/roundup/actions";
import type { FocusWeeklyRoundupData } from "@/lib/focus-board/roundup";

type FocusWeeklyRoundupProps = {
  roundup: FocusWeeklyRoundupData;
};

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function formatWeekRange(weekKey: string) {
  const start = new Date(`${weekKey}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const formatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function getResultLine(roundup: FocusWeeklyRoundupData) {
  if (roundup.hitTarget) {
    return "Weekly goal smashed. The scoreboard has been forced to admit it.";
  }

  if (roundup.weekPoints > 0) {
    return `${roundup.pointsToTarget} points short, but the evidence of effort is very much on the record.`;
  }

  return "A quiet week. Suspiciously quiet. The new one gets a fresh scoreboard.";
}

export function FocusWeeklyRoundup({ roundup }: FocusWeeklyRoundupProps) {
  const [displayPoints, setDisplayPoints] = useState(0);
  const [displayMonthPoints, setDisplayMonthPoints] = useState(0);
  const weeklyPercent = clampPercent((roundup.weekPoints / roundup.weeklyTarget) * 100);
  const maxRewardPoints = roundup.rewardTiers.at(-1)?.minPoints ?? roundup.weeklyTarget;
  const monthlyPercent = clampPercent((roundup.monthPoints / Math.max(maxRewardPoints, 1)) * 100);
  const topTasks = useMemo(
    () => [...roundup.taskBreakdown].sort((left, right) => right.points - left.points).slice(0, 4),
    [roundup.taskBreakdown],
  );

  useEffect(() => {
    const duration = 900;
    const startedAt = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayPoints(Math.round(roundup.weekPoints * eased));
      setDisplayMonthPoints(Math.round(roundup.monthPoints * eased));

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [roundup.monthPoints, roundup.weekPoints]);

  return (
    <div className={`focus-roundup ${roundup.hitTarget ? "focus-roundup-hit" : "focus-roundup-near"}`}>
      <section className="focus-roundup-hero">
        <div className="focus-roundup-copy">
          <p className="focus-kicker">Weekly roundup</p>
          <h1>{formatWeekRange(roundup.weekKey)}</h1>
          <p>{getResultLine(roundup)}</p>
        </div>
        <div className="focus-roundup-totaliser" aria-label={`${roundup.weekPoints} points last week`}>
          <span>Last week</span>
          <strong>{displayPoints}</strong>
          <small>of {roundup.weeklyTarget} pts</small>
        </div>
      </section>

      <section className="focus-roundup-progress">
        <div className="focus-roundup-progress-head">
          <div>
            <p className="focus-panel-label">Weekly target</p>
            <h2>{roundup.hitTarget ? "Hit" : `${roundup.pointsToTarget} pts to go`}</h2>
          </div>
          <span>{Math.round(weeklyPercent)}%</span>
        </div>
        <div className="focus-progress-track focus-progress-track-fat">
          <div className="focus-progress-fill" style={{ width: `${weeklyPercent}%` }} />
        </div>
      </section>

      <section className="focus-roundup-grid">
        <article className="focus-roundup-card focus-roundup-card-month">
          <p className="focus-panel-label">{roundup.monthLabel}</p>
          <h2>{displayMonthPoints} monthly pts</h2>
          <p>{roundup.weeksHit} weekly target{roundup.weeksHit === 1 ? "" : "s"} hit this month</p>
          <div className="focus-roundup-ladder">
            <div className="focus-roundup-ladder-fill" style={{ height: `${monthlyPercent}%` }} />
          </div>
          {roundup.currentReward ? (
            <strong>{roundup.currentReward.label} unlocked</strong>
          ) : roundup.nextReward ? (
            <strong>
              Next: {roundup.nextReward.label}
              {roundup.nextRewardPointsNeeded || roundup.nextRewardWeeksNeeded
                ? ` (${roundup.nextRewardPointsNeeded} pts, ${roundup.nextRewardWeeksNeeded} weeks)`
                : ""}
            </strong>
          ) : (
            <strong>Reward ladder complete</strong>
          )}
        </article>

        <article className="focus-roundup-card">
          <p className="focus-panel-label">Challenge breakdown</p>
          {topTasks.length ? (
            <div className="focus-roundup-task-list">
              {topTasks.map((task) => (
                <div className="focus-roundup-task" key={task.key}>
                  <span>{task.icon}</span>
                  <div>
                    <strong>{task.title}</strong>
                    <p>
                      {task.points} pts from {task.eventCount} action{task.eventCount === 1 ? "" : "s"}
                      {task.isBoosted ? " - boosted" : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>No points landed last week. Rude of time to keep moving, but here we are.</p>
          )}
        </article>
      </section>

      <form action={completeFocusWeeklyRoundupAction} className="focus-roundup-actions">
        <input name="slug" type="hidden" value={roundup.settings.boardSlug} />
        <input name="weekKey" type="hidden" value={roundup.weekKey} />
        <button className="button button-primary" type="submit">
          Start this week
        </button>
        <button className="button button-secondary" type="submit">
          Skip to board
        </button>
      </form>
    </div>
  );
}
