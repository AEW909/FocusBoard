"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { completeFocusWeeklyRoundupAction } from "@/app/board/[slug]/roundup/actions";
import { FocusImageWithFallback } from "@/components/focus/focus-image-with-fallback";
import type { FocusWeeklyRoundupData } from "@/lib/focus-board/roundup";

type FocusWeeklyRoundupProps = {
  isPreview?: boolean;
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

export function FocusWeeklyRoundup({ isPreview = false, roundup }: FocusWeeklyRoundupProps) {
  const [displayPoints, setDisplayPoints] = useState(0);
  const [displayMonthPoints, setDisplayMonthPoints] = useState(0);
  const weeklyPercent = clampPercent((roundup.weekPoints / roundup.weeklyTarget) * 100);
  const maxRewardPoints = roundup.rewardTiers.at(-1)?.minPoints ?? roundup.weeklyTarget;
  const monthlyPercent = clampPercent((roundup.monthPoints / Math.max(maxRewardPoints, 1)) * 100);
  const topTasks = useMemo(
    () => [...roundup.taskBreakdown].sort((left, right) => right.points - left.points).slice(0, 4),
    [roundup.taskBreakdown],
  );
  const unlockedRewardCount = roundup.rewardTiers.filter(
    (tier) => roundup.monthPoints >= tier.minPoints && roundup.weeksHit >= tier.minWeeksHit,
  ).length;

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
          <div className="focus-roundup-card-head">
            <div>
              <p className="focus-panel-label">{roundup.monthLabel}</p>
              <h2>{displayMonthPoints} monthly pts</h2>
            </div>
            <span>{unlockedRewardCount}/{roundup.rewardTiers.length} unlocked</span>
          </div>
          <p>{roundup.weeksHit} weekly target{roundup.weeksHit === 1 ? "" : "s"} hit this month</p>
          <div className="focus-roundup-reward-track" style={{ "--roundup-progress": `${monthlyPercent}%` } as CSSProperties}>
            {roundup.rewardTiers.map((tier, index) => {
              const unlocked = roundup.monthPoints >= tier.minPoints && roundup.weeksHit >= tier.minWeeksHit;

              return (
                <div
                  className={`focus-roundup-reward ${unlocked ? "focus-roundup-reward-unlocked" : "focus-roundup-reward-locked"}`}
                  key={tier.label}
                  style={{ "--roundup-entry-delay": `${index * 90}ms` } as CSSProperties}
                >
                  <div className="focus-roundup-reward-image">
                    <FocusImageWithFallback
                      alt={tier.stickerAlt}
                      fallbackSrc={unlocked ? tier.unlockedStickerFallbackSrc : tier.lockedStickerFallbackSrc}
                      src={unlocked ? tier.unlockedStickerSrc : tier.lockedStickerSrc}
                    />
                  </div>
                  <div className="focus-roundup-reward-copy">
                    <strong>{tier.label}</strong>
                    <p>{tier.minPoints}+ pts / {tier.minWeeksHit} weeks</p>
                  </div>
                  <span>{unlocked ? "Unlocked" : "Locked"}</span>
                </div>
              );
            })}
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

      {isPreview ? (
        <div className="focus-roundup-actions">
          <Link className="button button-primary" href={`/board/${roundup.settings.boardSlug}`}>
            Back to board
          </Link>
          <span className="focus-roundup-preview-note">Preview only - this will not mark the review as seen.</span>
        </div>
      ) : (
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
      )}
    </div>
  );
}
