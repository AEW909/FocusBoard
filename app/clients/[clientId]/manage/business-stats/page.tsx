import { notFound } from "next/navigation";
import {
  addBusinessStatCategoryAction,
  addBusinessStatGroupAction,
  deleteBusinessStatCategoryAction,
  deleteBusinessStatGroupAction,
  toggleBusinessStatCategoryVisibilityAction,
  toggleBusinessStatGroupVisibilityAction,
  updateBusinessStatCategoryAction,
  updateBusinessStatGroupAction,
} from "@/app/clients/[clientId]/manage/business-stats-actions";
import { ProtectedSessionBar } from "@/components/auth/protected-session-bar";
import { FocusPullToRefresh } from "@/components/focus/focus-pull-to-refresh";
import { requireManagedFocusClientById } from "@/lib/focus-board/access";
import { getBusinessStatsConfig } from "@/lib/focus-board/business-stats";
import { getFocusBoardRuntimeConfigByClientId } from "@/lib/focus-board/runtime";

export const dynamic = "force-dynamic";

type BusinessStatsSettingsPageProps = {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{
    businessStatsMessage?: string;
    businessStatsError?: string;
  }>;
};

export default async function BusinessStatsSettingsPage({
  params,
  searchParams,
}: BusinessStatsSettingsPageProps) {
  const { clientId } = await params;
  const query = await searchParams;
  const { client } = await requireManagedFocusClientById(
    clientId,
    `/clients/${clientId}/manage/business-stats`,
  );
  const [runtime, businessStats] = await Promise.all([
    getFocusBoardRuntimeConfigByClientId(client.clientId),
    getBusinessStatsConfig(client.clientId),
  ]);

  if (!runtime) {
    notFound();
  }

  const returnPath = `/clients/${client.clientId}/manage/business-stats`;

  return (
    <>
      <ProtectedSessionBar
        backHref="/clients"
        backLabel="Back to clients"
        homeHref={`/clients/${client.clientId}/manage`}
        homeLabel="Manage board"
        title="Business Stats Settings"
      />
      <main
        className={`shell focus-public-page focus-public-page-neon focus-board-shell-neon focus-control-page focus-theme-${runtime.settings.themePreset}`}
      >
        <FocusPullToRefresh label="Release to refresh Business Stats settings" />
        <section className="focus-arcade-hero focus-control-hero">
          <p className="focus-kicker">Module settings</p>
          <h1>Business stats</h1>
          <p className="focus-hero-copy">
            Configure the groups, weekly stats, visibility, and targets used by this board&apos;s
            Business Stats module.
          </p>
        </section>

        <section className="focus-control-stack">
          <article className="focus-control-card">
            <div className="focus-membership-stack">
              {query.businessStatsMessage ? (
                <p className="form-success">{query.businessStatsMessage}</p>
              ) : null}
              {query.businessStatsError ? (
                <p className="form-error">{query.businessStatsError}</p>
              ) : null}

              <div className="focus-business-admin-grid">
                <form action={addBusinessStatGroupAction} className="focus-control-form">
                  <input name="clientId" type="hidden" value={client.clientId} />
                  <input name="returnPath" type="hidden" value={returnPath} />
                  <h3>Add stat group</h3>
                  <label className="field">
                    <span>Group name</span>
                    <input name="name" placeholder="Marketing" required />
                  </label>
                  <label className="field">
                    <span>Group colour</span>
                    <input defaultValue="#00f5d4" name="color" type="color" />
                  </label>
                  <button className="button button-primary" type="submit">
                    Add group
                  </button>
                </form>

                <form action={addBusinessStatCategoryAction} className="focus-control-form">
                  <input name="clientId" type="hidden" value={client.clientId} />
                  <input name="returnPath" type="hidden" value={returnPath} />
                  <h3>Add stat</h3>
                  <label className="field">
                    <span>Group</span>
                    <select className="select-field" name="groupId">
                      <option value="">Ungrouped</option>
                      {businessStats.groups
                        .filter((group) => group.isActive !== false)
                        .map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Stat name</span>
                    <input name="name" placeholder="Leads generated" required />
                  </label>
                  <div className="focus-control-three-up">
                    <label className="field">
                      <span>Unit</span>
                      <select className="select-field" defaultValue="number" name="unit">
                        <option value="number">Number</option>
                        <option value="currency">Currency</option>
                        <option value="percent">Percent</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Prefix</span>
                      <input name="prefix" placeholder="GBP" />
                    </label>
                    <label className="field">
                      <span>Suffix</span>
                      <input name="suffix" placeholder="%" />
                    </label>
                  </div>
                  <div className="focus-control-two-up">
                    <label className="field">
                      <span>Weekly target</span>
                      <input min={0} name="weeklyTarget" step="any" type="number" />
                    </label>
                    <label className="field">
                      <span>Line colour</span>
                      <input defaultValue="#ff4dca" name="color" type="color" />
                    </label>
                  </div>
                  <button className="button button-primary" type="submit">
                    Add stat
                  </button>
                </form>
              </div>

              <div className="focus-business-admin-list">
                {businessStats.groups.length > 0 ? (
                  businessStats.groups.map((group) => {
                    const groupCategories = businessStats.categories.filter(
                      (category) => category.groupId === group.id,
                    );

                    return (
                      <article
                        className={`focus-business-admin-card ${
                          group.isVisible ? "" : "focus-business-admin-card-hidden"
                        }`}
                        key={group.id}
                      >
                        <div className="focus-business-admin-head">
                          <span style={{ background: group.color }} />
                          <div>
                            <h3>{group.name}</h3>
                            <p>
                              {groupCategories.length} stat{groupCategories.length === 1 ? "" : "s"} -
                              {" "}
                              {group.isVisible ? "visible" : "hidden"}
                            </p>
                          </div>
                        </div>

                        <form action={updateBusinessStatGroupAction} className="focus-control-two-up">
                          <input name="clientId" type="hidden" value={client.clientId} />
                          <input name="returnPath" type="hidden" value={returnPath} />
                          <input name="groupId" type="hidden" value={group.id} />
                          <label className="field">
                            <span>Name</span>
                            <input defaultValue={group.name} name="name" />
                          </label>
                          <label className="field">
                            <span>Colour</span>
                            <input defaultValue={group.color} name="color" type="color" />
                          </label>
                          <button className="button button-secondary" type="submit">
                            Save group
                          </button>
                        </form>

                        <div className="focus-membership-actions">
                          <form action={toggleBusinessStatGroupVisibilityAction}>
                            <input name="clientId" type="hidden" value={client.clientId} />
                            <input name="returnPath" type="hidden" value={returnPath} />
                            <input name="groupId" type="hidden" value={group.id} />
                            <input
                              name="nextVisible"
                              type="hidden"
                              value={group.isVisible ? "false" : "true"}
                            />
                            <button className="button focus-membership-content-button" type="submit">
                              {group.isVisible ? "Hide group" : "Show group"}
                            </button>
                          </form>
                          <form action={deleteBusinessStatGroupAction}>
                            <input name="clientId" type="hidden" value={client.clientId} />
                            <input name="returnPath" type="hidden" value={returnPath} />
                            <input name="groupId" type="hidden" value={group.id} />
                            <button className="button button-management" type="submit">
                              Retire group
                            </button>
                          </form>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <p className="focus-membership-empty">
                    No stat groups yet. Add Marketing, Sales, IT, or whatever structure fits this board.
                  </p>
                )}

                {businessStats.categories.length > 0 ? (
                  businessStats.categories.map((category) => (
                    <article
                      className={`focus-business-admin-card ${
                        category.isVisible ? "" : "focus-business-admin-card-hidden"
                      }`}
                      key={category.id}
                    >
                      <div className="focus-business-admin-head">
                        <span style={{ background: category.color }} />
                        <div>
                          <h3>{category.name}</h3>
                          <p>
                            {category.isVisible ? "visible" : "hidden"}
                            {category.weeklyTarget !== null
                              ? ` - target ${category.prefix}${category.weeklyTarget}${category.suffix}`
                              : ""}
                          </p>
                        </div>
                      </div>

                      <form action={updateBusinessStatCategoryAction} className="focus-control-form">
                        <input name="clientId" type="hidden" value={client.clientId} />
                        <input name="returnPath" type="hidden" value={returnPath} />
                        <input name="categoryId" type="hidden" value={category.id} />
                        <div className="focus-control-two-up">
                          <label className="field">
                            <span>Group</span>
                            <select className="select-field" defaultValue={category.groupId ?? ""} name="groupId">
                              <option value="">Ungrouped</option>
                              {businessStats.groups
                                .filter((group) => group.isActive !== false)
                                .map((group) => (
                                  <option key={group.id} value={group.id}>
                                    {group.name}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <label className="field">
                            <span>Name</span>
                            <input defaultValue={category.name} name="name" />
                          </label>
                        </div>
                        <div className="focus-control-three-up">
                          <label className="field">
                            <span>Unit</span>
                            <select className="select-field" defaultValue={category.unit} name="unit">
                              <option value="number">Number</option>
                              <option value="currency">Currency</option>
                              <option value="percent">Percent</option>
                            </select>
                          </label>
                          <label className="field">
                            <span>Prefix</span>
                            <input defaultValue={category.prefix} name="prefix" />
                          </label>
                          <label className="field">
                            <span>Suffix</span>
                            <input defaultValue={category.suffix} name="suffix" />
                          </label>
                        </div>
                        <div className="focus-control-two-up">
                          <label className="field">
                            <span>Weekly target</span>
                            <input
                              defaultValue={category.weeklyTarget ?? ""}
                              min={0}
                              name="weeklyTarget"
                              step="any"
                              type="number"
                            />
                          </label>
                          <label className="field">
                            <span>Line colour</span>
                            <input defaultValue={category.color} name="color" type="color" />
                          </label>
                        </div>
                        <button className="button button-secondary" type="submit">
                          Save stat
                        </button>
                      </form>

                      <div className="focus-membership-actions">
                        <form action={toggleBusinessStatCategoryVisibilityAction}>
                          <input name="clientId" type="hidden" value={client.clientId} />
                          <input name="returnPath" type="hidden" value={returnPath} />
                          <input name="categoryId" type="hidden" value={category.id} />
                          <input
                            name="nextVisible"
                            type="hidden"
                            value={category.isVisible ? "false" : "true"}
                          />
                          <button className="button focus-membership-content-button" type="submit">
                            {category.isVisible ? "Hide stat" : "Show stat"}
                          </button>
                        </form>
                        <form action={deleteBusinessStatCategoryAction}>
                          <input name="clientId" type="hidden" value={client.clientId} />
                          <input name="returnPath" type="hidden" value={returnPath} />
                          <input name="categoryId" type="hidden" value={category.id} />
                          <button className="button button-management" type="submit">
                            Retire stat
                          </button>
                        </form>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="focus-membership-empty">
                    No stats yet. Add one above, then the weekly collection page will appear for users.
                  </p>
                )}
              </div>
            </div>
          </article>
        </section>
      </main>
    </>
  );
}
