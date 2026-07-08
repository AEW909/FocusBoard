import { notFound } from "next/navigation";
import { updateFocusClientContentProfileAction } from "@/app/clients/[clientId]/manage/content-profile-actions";
import { ProtectedSessionBar } from "@/components/auth/protected-session-bar";
import { FocusPullToRefresh } from "@/components/focus/focus-pull-to-refresh";
import { requireManagedFocusClientById } from "@/lib/focus-board/access";
import { getFocusContentProfile } from "@/lib/focus-board/content-profiles";
import { getFocusBoardRuntimeConfigByClientId } from "@/lib/focus-board/runtime";

export const dynamic = "force-dynamic";

type ContentLabSettingsPageProps = {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{
    contentProfileMessage?: string;
    contentProfileError?: string;
  }>;
};

export default async function ContentLabSettingsPage({
  params,
  searchParams,
}: ContentLabSettingsPageProps) {
  const { clientId } = await params;
  const query = await searchParams;
  const { client } = await requireManagedFocusClientById(
    clientId,
    `/clients/${clientId}/manage/content-lab`,
  );
  const [runtime, contentProfile] = await Promise.all([
    getFocusBoardRuntimeConfigByClientId(client.clientId),
    getFocusContentProfile(client.clientId, client.displayName),
  ]);

  if (!runtime) {
    notFound();
  }

  const returnPath = `/clients/${client.clientId}/manage/content-lab`;

  return (
    <>
      <ProtectedSessionBar
        backHref="/clients"
        backLabel="Back to clients"
        homeHref={`/clients/${client.clientId}/manage`}
        homeLabel="Manage board"
        title="Content Lab Settings"
      />
      <main
        className={`shell focus-public-page focus-public-page-neon focus-board-shell-neon focus-control-page focus-theme-${runtime.settings.themePreset}`}
      >
        <FocusPullToRefresh label="Release to refresh Content Lab settings" />
        <section className="focus-arcade-hero focus-control-hero">
          <p className="focus-kicker">Module settings</p>
          <h1>Content Lab context</h1>
          <p className="focus-hero-copy">
            Tune the business profile used when this board generates Content Lab ideas.
          </p>
        </section>

        <section className="focus-control-stack">
          <article className="focus-control-card">
            <div className="focus-content-profile-stack">
              {query.contentProfileMessage ? (
                <p className="form-success">{query.contentProfileMessage}</p>
              ) : null}
              {query.contentProfileError ? (
                <p className="form-error">{query.contentProfileError}</p>
              ) : null}

              <form action={updateFocusClientContentProfileAction} className="focus-control-form">
                <input name="clientId" type="hidden" value={client.clientId} />
                <input name="returnPath" type="hidden" value={returnPath} />
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
          </article>
        </section>
      </main>
    </>
  );
}
