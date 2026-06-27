"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
  const dayFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: "UTC" });
  const fullFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const startMonth = start.getUTCMonth();
  const endMonth = end.getUTCMonth();

  if (startMonth === endMonth) {
    return `${dayFormatter.format(start)}-${fullFormatter.format(end)}`;
  }

  return `${fullFormatter.format(start)}-${fullFormatter.format(end)}`;
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

function useRoundupInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [hasEntered, setHasEntered] = useState(false);

  useEffect(() => {
    const node = ref.current;

    if (!node || hasEntered) {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      setHasEntered(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setHasEntered(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.28 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasEntered]);

  return { hasEntered, ref };
}

const CHART_COLORS = ["#ff7e45", "#ffd166", "#7bdff2", "#cdb4db", "#95d5b2", "#ffafcc"];

export function FocusWeeklyRoundup({ isPreview = false, roundup }: FocusWeeklyRoundupProps) {
  const [displayPoints, setDisplayPoints] = useState(0);
  const [displayMonthPoints, setDisplayMonthPoints] = useState(0);
  const breakdownInView = useRoundupInView<HTMLElement>();
  const rewardsInView = useRoundupInView<HTMLElement>();
  const weeklyPercent = clampPercent((roundup.weekPoints / roundup.weeklyTarget) * 100);
  const maxRewardPoints = roundup.rewardTiers.at(-1)?.minPoints ?? roundup.weeklyTarget;
  const monthlyPercent = clampPercent((roundup.monthPoints / Math.max(maxRewardPoints, 1)) * 100);
  const topTasks = useMemo(
    () => [...roundup.taskBreakdown].sort((left, right) => right.points - left.points).slice(0, 4),
    [roundup.taskBreakdown],
  );
  const pieTasks = useMemo(
    () => [...roundup.taskBreakdown].filter((task) => task.points > 0).sort((left, right) => right.points - left.points),
    [roundup.taskBreakdown],
  );
  const sectionPointsTotal = roundup.sectionBreakdown.reduce((sum, section) => sum + section.points, 0);
  const pieTotal = pieTasks.reduce((sum, task) => sum + task.points, 0);
  let runningPercent = 0;
  const pieGradient = pieTasks.length
    ? pieTasks
        .map((task, index) => {
          const start = runningPercent;
          const end = runningPercent + (task.points / pieTotal) * 100;
          runningPercent = end;
          return `${CHART_COLORS[index % CHART_COLORS.length]} ${start}% ${end}%`;
        })
        .join(", ")
    : "rgba(255, 255, 255, 0.12) 0% 100%";
  const unlockedRewardCount = roundup.rewardTiers.filter(
    (tier) => roundup.monthPoints >= tier.minPoints && roundup.weeksHit >= tier.minWeeksHit,
  ).length;

  useEffect(() => {
    const duration = 2200;
    const startedAt = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayPoints(Math.round(roundup.weekPoints * eased));

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [roundup.weekPoints]);

  useEffect(() => {
    if (!rewardsInView.hasEntered) {
      return;
    }

    const duration = 3200;
    const startedAt = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayMonthPoints(Math.round(roundup.monthPoints * eased));

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [rewardsInView.hasEntered, roundup.monthPoints]);

  return (
    <div className={`focus-roundup ${roundup.hitTarget ? "focus-roundup-hit" : "focus-roundup-near"}`}>
      <section className="focus-roundup-hero">
        <div className="focus-roundup-copy">
          <p className="focus-kicker">Weekly roundup</p>
          <h1>{formatWeekRange(roundup.weekKey)}</h1>
          <div className="focus-roundup-totaliser" aria-label={`${roundup.weekPoints} points last week`}>
            <span>Last week</span>
            <strong>{displayPoints}</strong>
            <small>of {roundup.weeklyTarget} pts</small>
          </div>
          <p>{getResultLine(roundup)}</p>
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
        {roundup.sectionBreakdown.length ? (
          <article className="focus-roundup-card">
            <p className="focus-panel-label">Goal areas</p>
            <div className="focus-roundup-section-list">
              {roundup.sectionBreakdown.map((section, index) => {
                const share = sectionPointsTotal > 0 ? Math.round((section.points / sectionPointsTotal) * 100) : 0;

                return (
                  <div className="focus-roundup-section-item" key={section.key}>
                    <span style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                    <div>
                      <strong>{section.title}</strong>
                      <p>
                        {section.points} pts{share > 0 ? ` - ${share}%` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        ) : null}

        <article
          className={`focus-roundup-card focus-roundup-card-breakdown ${
            breakdownInView.hasEntered ? "focus-roundup-card-visible" : ""
          }`}
          ref={breakdownInView.ref}
        >
          <p className="focus-panel-label">Challenge breakdown</p>
          {pieTasks.length ? (
            <div className="focus-roundup-breakdown-wrap">
              <div
                aria-label={`${roundup.weekPoints} points split by challenge`}
                className="focus-roundup-pie"
                role="img"
                style={{ "--roundup-pie-gradient": pieGradient } as CSSProperties}
              >
                <strong>{roundup.weekPoints}</strong>
                <span>pts</span>
              </div>
              <div className="focus-roundup-task-list">
                {topTasks.map((task, index) => (
                  <div
                    className="focus-roundup-task"
                    key={task.key}
                    style={{ "--roundup-task-color": CHART_COLORS[index % CHART_COLORS.length] } as CSSProperties}
                  >
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
            </div>
          ) : (
            <p>No points landed last week. Rude of time to keep moving, but here we are.</p>
          )}
        </article>

        <article
          className={`focus-roundup-card focus-roundup-card-month ${
            rewardsInView.hasEntered ? "focus-roundup-card-visible" : ""
          }`}
          ref={rewardsInView.ref}
        >
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
                  style={{ "--roundup-entry-delay": `${index * 1500}ms` } as CSSProperties}
                >
                  {unlocked ? (
                    <div aria-hidden="true" className="focus-roundup-confetti">
                      {Array.from({ length: 10 }, (_, confettiIndex) => (
                        <i
                          key={confettiIndex}
                          style={
                            {
                              "--confetti-delay": `${460 + confettiIndex * 54}ms`,
                              "--confetti-hue": `${confettiIndex * 39}deg`,
                              "--confetti-index": confettiIndex,
                              "--confetti-y": `${-56 + (confettiIndex % 5) * 22}px`,
                            } as CSSProperties
                          }
                        />
                      ))}
                    </div>
                  ) : null}
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
