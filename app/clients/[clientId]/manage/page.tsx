import { notFound } from "next/navigation";
import {
  addFocusBoardTaskAction,
  updateFocusBoardSettingsAction,
  updateFocusRewardTierAction,
  updateFocusWeeklyRewardAction,
} from "@/app/focus-control/actions";
import {
  addFocusClientMembershipAction,
  setFocusClientContentLabEnabledAction,
  setFocusClientMembershipContentLabAccessAction,
  setFocusClientMembershipActiveAction,
  updateFocusClientMembershipRoleAction,
} from "@/app/clients/[clientId]/manage/membership-actions";
import { updateFocusClientContentProfileAction } from "@/app/clients/[clientId]/manage/content-profile-actions";
import { ProtectedSessionBar } from "@/components/auth/protected-session-bar";
import { FocusAssetUploadForm } from "@/components/focus/focus-asset-upload-form";
import { FocusControlExistingGoals } from "@/components/focus/focus-control-existing-goals";
import { FocusImageSelect } from "@/components/focus/focus-image-select";
import { FocusPullToRefresh } from "@/components/focus/focus-pull-to-refresh";
import { getFocusAssetOptions } from "@/lib/focus-board/assets";
import { requireManagedFocusClientById } from "@/lib/focus-board/access";
import { FOCUS_THEME_OPTIONS } from "@/lib/focus-board/config";
import { getFocusContentProfile } from "@/lib/focus-board/content-profiles";
import { getManagedFocusClientMemberships } from "@/lib/focus-board/memberships";
import { getFocusBoardRuntimeConfigByClientId } from "@/lib/focus-board/runtime";

export const dynamic = "force-dynamic";

type FocusClientManagePageProps = {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{
    membershipMessage?: string;
    membershipError?: string;
    contentProfileMessage?: string;
    contentProfileError?: string;
  }>;
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

function formatMembershipRole(role: "client_admin" | "client_user") {
  return role === "client_admin" ? "Client admin" : "Client user";
}

function formatContentLabState(enabled: boolean) {
  return enabled ? "Enabled" : "Disabled";
}

export default async function FocusClientManagePage({
  params,
  searchParams,
}: FocusClientManagePageProps) {
  const { clientId } = await params;
  const query = await searchParams;
  const { client } = await requireManagedFocusClientById(clientId, `/clients/${clientId}/manage`);
  const [runtime, assets, memberships, contentProfile] = await Promise.all([
    getFocusBoardRuntimeConfigByClientId(client.clientId),
    getFocusAssetOptions(),
    getManagedFocusClientMemberships(client.clientId),
    getFocusContentProfile(client.clientId, client.displayName),
  ]);

  if (!runtime) {
    notFound();
  }

  const defaultChallengeSticker =
    assets.find((asset) => asset.fallbackValue === "/focus/mascot-rainbow.svg")?.value ??
    "/focus/mascot-rainbow.svg";

  return (
    <>
      <ProtectedSessionBar
        backHref="/clients"
        backLabel="Back to clients"
        homeHref={`/board/${runtime.settings.boardSlug}`}
        title="Control Room"
      />
      <main
        className={`shell focus-public-page focus-public-page-neon focus-board-shell-neon focus-control-page focus-theme-${runtime.settings.themePreset}`}
      >
        <FocusPullToRefresh label="Release to refresh controls" />
        <section className="focus-arcade-hero focus-control-hero">
          <p className="focus-kicker">Secret focus control room</p>
          <h1>Tune the game board</h1>
          <p className="focus-hero-copy">
            Change the weekly target, add new goals, adjust point weights, and reshape the reward ladder without touching code again.
          </p>
          <div className="focus-control-links">
            <div className="focus-control-link-card">
              <strong>Client</strong>
              <p>{client.displayName}</p>
            </div>
            <div className="focus-control-link-card">
              <strong>Board route</strong>
              <p>/board/{runtime.settings.boardSlug}</p>
            </div>
          </div>
        </section>

        <section className="focus-control-grid">
          <FocusControlSection
            eyebrow="Content profile"
            summary="Store the business context that powers client-specific Content Lab prompts."
            title="Content Lab context"
          >
            <div className="focus-content-profile-stack">
              {query.contentProfileMessage ? (
                <p className="form-success">{query.contentProfileMessage}</p>
              ) : null}
              {query.contentProfileError ? (
                <p className="form-error">{query.contentProfileError}</p>
              ) : null}

              <form
                action={updateFocusClientContentProfileAction}
                className="focus-control-form"
              >
                <input name="clientId" type="hidden" value={client.clientId} />
                <label className="field">
                  <span>Business name</span>
                  <input defaultValue={contentProfile.businessName} name="businessName" required />
                </label>
                <label className="field">
                  <span>Brand voice</span>
                  <textarea
                    defaultValue={contentProfile.brandVoice}
                    name="brandVoice"
                    placeholder="Warm, credible, premium-but-human..."
                  />
                </label>
                <label className="field">
                  <span>Target audience</span>
                  <textarea
                    defaultValue={contentProfile.targetAudience}
                    name="targetAudience"
                    placeholder="Who the business serves, what they value, what concerns they bring..."
                  />
                </label>
                <label className="field">
                  <span>Services / offers</span>
                  <textarea
                    defaultValue={contentProfile.services}
                    name="services"
                    placeholder="Core services, signature programmes, flagship offers..."
                  />
                </label>
                <label className="field">
                  <span>Differentiators</span>
                  <textarea
                    defaultValue={contentProfile.differentiators}
                    name="differentiators"
                    placeholder="Credentials, methods, location, founder story, reasons to trust this business..."
                  />
                </label>
                <label className="field">
                  <span>Content rules</span>
                  <textarea
                    defaultValue={contentProfile.contentRules}
                    name="contentRules"
                    placeholder="Words to avoid, claims guidance, legal notes, CTA style, hashtag preferences..."
                  />
                </label>
                <button className="button button-primary" type="submit">
                  Save Content Lab profile
                </button>
              </form>
            </div>
          </FocusControlSection>

          <FocusControlSection
            eyebrow="Client access"
            summary="Grant or remove board access for existing signed-in users, including Content Lab access."
            title="User management"
          >
            <div className="focus-membership-stack">
              {query.membershipMessage ? (
                <p className="form-success">{query.membershipMessage}</p>
              ) : null}
              {query.membershipError ? <p className="form-error">{query.membershipError}</p> : null}

              <div className="focus-membership-feature-bar">
                <div>
                  <p className="focus-membership-role-note">Client feature</p>
                  <h3>Content Lab {formatContentLabState(client.contentLabEnabled)}</h3>
                  <p className="focus-membership-role-note">
                    Turn the feature on for this client, then assign it to the users who should see it.
                  </p>
                </div>
                <form action={setFocusClientContentLabEnabledAction}>
                  <input name="clientId" type="hidden" value={client.clientId} />
                  <input
                    name="nextEnabled"
                    type="hidden"
                    value={client.contentLabEnabled ? "false" : "true"}
                  />
                  <button className="button focus-membership-content-button" type="submit">
                    {client.contentLabEnabled ? "Disable for client" : "Enable for client"}
                  </button>
                </form>
              </div>

              <form action={addFocusClientMembershipAction} className="focus-membership-add-form">
                <input name="clientId" type="hidden" value={client.clientId} />
                <label className="field">
                  <span>Existing user email</span>
                  <input
                    name="email"
                    placeholder="name@example.com"
                    required
                    type="email"
                  />
                </label>
                <label className="field">
                  <span>Role</span>
                  <select className="select-field" defaultValue="client_user" name="role">
                    <option value="client_user">Client user</option>
                    <option value="client_admin">Client admin</option>
                  </select>
                </label>
                <label className="field">
                  <span>Content Lab</span>
                  <select
                    className="select-field"
                    defaultValue={client.contentLabEnabled ? "true" : "false"}
                    disabled={!client.contentLabEnabled}
                    name="contentLabAccess"
                  >
                    <option value="false">Disabled</option>
                    <option value="true">Enabled</option>
                  </select>
                </label>
                <button className="button button-primary" type="submit">
                  Add user to client
                </button>
              </form>

              {memberships.length > 0 ? (
                <div className="focus-membership-list">
                  {memberships.map((membership) => (
                    <article
                      className={`focus-membership-card ${
                        membership.isActive ? "" : "focus-membership-card-inactive"
                      }`}
                      key={membership.membershipId}
                    >
                      <div className="focus-membership-card-head">
                        <div>
                          <h3>{membership.fullName ?? membership.email}</h3>
                          <p>{membership.email}</p>
                        </div>
                        <span
                          className={`focus-client-status ${
                            membership.isActive
                              ? "focus-client-status-active"
                              : "focus-client-status-inactive"
                          }`}
                        >
                          {membership.isActive ? "active" : "inactive"}
                        </span>
                      </div>

                      <div className="focus-membership-actions">
                        <form
                          action={updateFocusClientMembershipRoleAction}
                          className="focus-membership-role-form"
                        >
                          <input name="clientId" type="hidden" value={client.clientId} />
                          <input
                            name="membershipId"
                            type="hidden"
                            value={membership.membershipId}
                          />
                          <label className="field">
                            <span>Role</span>
                            <select
                              className="select-field"
                              defaultValue={membership.role}
                              name="role"
                            >
                              <option value="client_user">Client user</option>
                              <option value="client_admin">Client admin</option>
                            </select>
                          </label>
                          <button className="button button-secondary" type="submit">
                            Save role
                          </button>
                        </form>

                        <form action={setFocusClientMembershipContentLabAccessAction}>
                          <input name="clientId" type="hidden" value={client.clientId} />
                          <input
                            name="membershipId"
                            type="hidden"
                            value={membership.membershipId}
                          />
                          <input
                            name="nextContentLabAccess"
                            type="hidden"
                            value={membership.contentLabAccess ? "false" : "true"}
                          />
                          <button
                            className="button focus-membership-content-button"
                            disabled={!client.contentLabEnabled || !membership.isActive}
                            type="submit"
                          >
                            {membership.contentLabAccess ? "Disable Content Lab" : "Enable Content Lab"}
                          </button>
                        </form>

                        <form action={setFocusClientMembershipActiveAction}>
                          <input name="clientId" type="hidden" value={client.clientId} />
                          <input
                            name="membershipId"
                            type="hidden"
                            value={membership.membershipId}
                          />
                          <input
                            name="nextActive"
                            type="hidden"
                            value={membership.isActive ? "false" : "true"}
                          />
                          <button className="button button-management" type="submit">
                            {membership.isActive ? "Remove access" : "Restore access"}
                          </button>
                        </form>
                      </div>

                      <p className="focus-membership-role-note">
                        Current role: {formatMembershipRole(membership.role)}
                      </p>
                      <p className="focus-membership-role-note">
                        Content Lab: {formatContentLabState(membership.contentLabAccess)}
                        {!client.contentLabEnabled ? " (client feature disabled)" : ""}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="focus-membership-empty">
                  No client users are linked yet. Add an existing signed-in account above.
                </p>
              )}
            </div>
          </FocusControlSection>

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
              <label className="field">
                <span>Board colour theme</span>
                <select
                  className="select-field"
                  defaultValue={runtime.settings.themePreset}
                  name="themePreset"
                >
                  {FOCUS_THEME_OPTIONS.map((theme) => (
                    <option key={theme.value} value={theme.value}>
                      {theme.label} - {theme.description}
                    </option>
                  ))}
                </select>
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
            summary="The immediate reward unlocked whenever the weekly points target is reached."
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
