import { notFound } from "next/navigation";
import {
  addFocusBoardTaskAction,
  updateFocusBoardSettingsAction,
  updateFocusRewardTierAction,
  updateFocusWeeklyRewardAction,
} from "@/app/focus-control/actions";
import { ProtectedSessionBar } from "@/components/auth/protected-session-bar";
import { FocusAssetUploadForm } from "@/components/focus/focus-asset-upload-form";
import { FocusControlExistingGoals } from "@/components/focus/focus-control-existing-goals";
import { FocusImageSelect } from "@/components/focus/focus-image-select";
import { FocusPullToRefresh } from "@/components/focus/focus-pull-to-refresh";
import { requireFocusPlatformOwner } from "@/lib/focus-board/access";
import { getFocusAssetOptions } from "@/lib/focus-board/assets";
import { getFocusBoardRuntimeConfigByAdminSlug } from "@/lib/focus-board/runtime";

export const dynamic = "force-dynamic";

type FocusControlPageProps = {
  params: Promise<{ slug: string }>;
};

type FocusControlSectionProps = {
  eyebrow: string;
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

function FocusControlSection({
  eyebrow,
  title,
  summary,
  defaultOpen = false,
  children,
}: FocusControlSectionProps) {
  return (
    <details className="focus-control-section" open={defaultOpen}>
      <summary className="focus-control-section-summary">
        <div className="focus-control-section-copy">
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          {summary ? <p>{summary}</p> : null}
        </div>
        <span className="focus-control-collapse-icon" aria-hidden="true">
          +
        </span>
      </summary>
      <article className="focus-control-card focus-control-section-body">{children}</article>
    </details>
  );
}

export default async function FocusControlPage({ params }: FocusControlPageProps) {
  const { slug } = await params;
  await requireFocusPlatformOwner(`/focus-control/${slug}`);
  const [runtime, assets] = await Promise.all([
    getFocusBoardRuntimeConfigByAdminSlug(slug),
    getFocusAssetOptions(),
  ]);

  if (!runtime) {
    notFound();
  }

  const defaultChallengeSticker = assets.find((asset) => asset.fallbackValue === "/focus/mascot-rainbow.svg")?.value ?? "/focus/mascot-rainbow.svg";

  return (
    <>
      <ProtectedSessionBar
        backHref="/clients"
        backLabel="Back to clients"
        homeHref={`/focus/${runtime.settings.boardSlug}`}
        title="Control Room"
      />
      <main className="shell focus-public-page focus-public-page-neon focus-board-shell-neon focus-control-page">
        <FocusPullToRefresh label="Release to refresh controls" />
        <section className="focus-arcade-hero focus-control-hero">
          <p className="focus-kicker">Secret focus control room</p>
          <h1>Tune the game board</h1>
          <p className="focus-hero-copy">
            Change the weekly target, add new goals, adjust point weights, and reshape the reward ladder without touching code again.
          </p>
          <div className="focus-control-links">
            <div className="focus-control-link-card">
              <strong>Public board</strong>
              <p>/focus/{runtime.settings.boardSlug}</p>
            </div>
            <div className="focus-control-link-card">
              <strong>Control page</strong>
              <p>/focus-control/{runtime.settings.adminSlug}</p>
            </div>
          </div>
        </section>

        <section className="focus-control-grid">
          <FocusControlSection
            eyebrow="Board settings"
            summary="Weekly target, title, and the bit of hype text at the top."
            title="Weekly target + headline"
          >
            <form action={updateFocusBoardSettingsAction} className="focus-control-form">
              <input name="adminSlug" type="hidden" value={runtime.settings.adminSlug} />
              <label className="field">
                <span>Title / kicker</span>
                <input defaultValue={runtime.settings.title} name="title" />
              </label>
              <label className="field">
                <span>Main headline</span>
                <textarea defaultValue={runtime.settings.subtitle} name="subtitle" />
              </label>
              <button className="button button-primary" type="submit">
                Save board settings
              </button>
            </form>
          </FocusControlSection>

          <FocusControlSection
            eyebrow="Add a goal"
            summary="Create a fresh weekly challenge and give it its first scoring metric."
            title="New weekly challenge"
          >
            <form action={addFocusBoardTaskAction} className="focus-control-form">
              <input name="adminSlug" type="hidden" value={runtime.settings.adminSlug} />
              <div className="focus-control-two-up">
                <label className="field">
                  <span>Goal title</span>
                  <input name="title" placeholder="Example: Ask for referrals" required />
                </label>
                <label className="field">
                  <span>Badge text</span>
                  <input name="icon" placeholder="REF" />
                </label>
              </div>
              <label className="field">
                <span>Description / help text</span>
                <textarea
                  name="description"
                  placeholder="What counts as completing this one?"
                  required
                />
              </label>
              <div className="focus-control-three-up">
                <label className="field">
                  <span>Metric label</span>
                  <input name="metricLabel" placeholder="Asked" required />
                </label>
                <label className="field">
                  <span>Target</span>
                  <input defaultValue={1} min={0} name="target" type="number" />
                </label>
                <label className="field">
                  <span>Points each</span>
                  <input defaultValue={5} name="points" type="number" />
                </label>
              </div>
              <div className="focus-control-three-up">
                <label className="field">
                  <span>Kind</span>
                  <select className="select-field" defaultValue="count" name="kind">
                    <option value="count">Count</option>
                    <option value="toggle">Toggle</option>
                  </select>
                </label>
                <FocusImageSelect
                  assets={assets}
                  label="Sticker image"
                  name="stickerSrc"
                  value={defaultChallengeSticker}
                />
                <label className="field">
                  <span>Sticker alt (optional)</span>
                  <input name="stickerAlt" placeholder="Custom goal sticker" />
                </label>
              </div>
              <button className="button button-primary" type="submit">
                Add weekly goal
              </button>
            </form>
          </FocusControlSection>
        </section>

        <section className="focus-control-stack">
          <FocusControlSection
            eyebrow="Images"
            summary="Upload extra artwork for challenge stickers and reward ladder images."
            title="Focus image library"
          >
            <FocusAssetUploadForm adminSlug={runtime.settings.adminSlug} />
            <div className="focus-asset-grid">
              {assets.map((asset) => (
                <div className="focus-asset-chip" key={`${asset.source}:${asset.value}`}>
                  <img alt="" src={asset.value} />
                  <span>{asset.label}</span>
                  <small>{asset.source === "uploaded" ? "Uploaded" : "Bundled"}</small>
                </div>
              ))}
            </div>
          </FocusControlSection>

          <FocusControlSection
            defaultOpen
            eyebrow="Goals"
            summary={`${runtime.allTasks.length} challenge${runtime.allTasks.length === 1 ? "" : "s"} currently on the board.`}
            title="Existing weekly challenges"
          >
            <div className="focus-control-stack">
              <FocusControlExistingGoals
                adminSlug={runtime.settings.adminSlug}
                assets={assets}
                tasks={runtime.allTasks}
              />
            </div>
          </FocusControlSection>

          <FocusControlSection
            eyebrow="Weekly prize"
            summary="The immediate reward Liona unlocks whenever she reaches the weekly points target."
            title="Weekly reward"
          >
            <form action={updateFocusWeeklyRewardAction} className="focus-control-reward-row">
              <input name="adminSlug" type="hidden" value={runtime.settings.adminSlug} />
              <div className="focus-control-two-up">
                <label className="field">
                  <span>Weekly points target</span>
                  <input defaultValue={runtime.settings.weeklyTarget} min={1} name="weeklyTarget" type="number" />
                </label>
                <label className="field">
                  <span>Reward label</span>
                  <input defaultValue={runtime.weeklyReward.label} name="label" />
                </label>
              </div>
              <div className="focus-control-two-up">
                <label className="field">
                  <span>Text while locked</span>
                  <textarea
                    defaultValue={runtime.weeklyReward.lockedDescription}
                    name="lockedDescription"
                  />
                </label>
                <label className="field">
                  <span>Text once unlocked</span>
                  <textarea
                    defaultValue={runtime.weeklyReward.unlockedDescription}
                    name="unlockedDescription"
                  />
                </label>
              </div>
              <label className="field">
                <span>Sticker alt</span>
                <input defaultValue={runtime.weeklyReward.stickerAlt} name="stickerAlt" />
              </label>
              <div className="focus-control-two-up">
                <FocusImageSelect
                  assets={assets}
                  label="Locked image"
                  name="lockedStickerSrc"
                  value={runtime.weeklyReward.lockedStickerSrc}
                />
                <FocusImageSelect
                  assets={assets}
                  label="Unlocked image"
                  name="unlockedStickerSrc"
                  value={runtime.weeklyReward.unlockedStickerSrc}
                />
              </div>
              <button className="button button-primary" type="submit">
                Save weekly reward
              </button>
            </form>
          </FocusControlSection>

          <FocusControlSection
            eyebrow="Prizes"
            summary="Locked and unlocked reward art, thresholds, and tier copy."
            title="Reward ladder"
          >
            <div className="focus-control-stack">
              {runtime.rewards.map((reward) => (
                <form action={updateFocusRewardTierAction} className="focus-control-reward-row" key={reward.id ?? reward.label}>
                  <input name="adminSlug" type="hidden" value={runtime.settings.adminSlug} />
                  <input name="rewardId" type="hidden" value={reward.id} />
                  <div className="focus-control-two-up">
                    <label className="field">
                      <span>Reward label</span>
                      <input defaultValue={reward.label} name="label" />
                    </label>
                    <label className="field">
                      <span>Sticker alt</span>
                      <input defaultValue={reward.stickerAlt} name="stickerAlt" />
                    </label>
                  </div>
                  <label className="field">
                    <span>Description</span>
                    <textarea defaultValue={reward.description} name="description" />
                  </label>
                  <div className="focus-control-three-up">
                    <label className="field">
                      <span>Min points</span>
                      <input defaultValue={reward.minPoints} min={0} name="minPoints" type="number" />
                    </label>
                    <label className="field">
                      <span>Min weeks hit</span>
                      <input defaultValue={reward.minWeeksHit} min={0} name="minWeeksHit" type="number" />
                    </label>
                  </div>
                  <div className="focus-control-two-up">
                    <FocusImageSelect
                      assets={assets}
                      label="Locked image"
                      name="lockedStickerSrc"
                      value={reward.lockedStickerSrc}
                    />
                    <FocusImageSelect
                      assets={assets}
                      label="Unlocked image"
                      name="unlockedStickerSrc"
                      value={reward.unlockedStickerSrc}
                    />
                  </div>
                  <button className="button button-secondary" type="submit">
                    Save prize
                  </button>
                </form>
              ))}
            </div>
          </FocusControlSection>
        </section>
      </main>
    </>
  );
}
