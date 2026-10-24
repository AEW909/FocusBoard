import Link from "next/link";
import { ProtectedSessionBar } from "@/components/auth/protected-session-bar";
import { DisplayTokenForm } from "@/components/display/display-token-form";
import { requireFocusPlatformOwner } from "@/lib/focus-board/access";
import { getBoardDisplayGroups, listDisplayTokens } from "@/lib/focus-board/display-tokens";
import { revokeDisplayTokenAction, setBoardDisplayGroupAction } from "./actions";

export const dynamic = "force-dynamic";

type DisplayAdminPageProps = {
  searchParams: Promise<{ message?: string; error?: string }>;
};

function formatDate(date: Date | null) {
  return date
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date)
    : "never";
}

export default async function DisplayAdminPage({ searchParams }: DisplayAdminPageProps) {
  await requireFocusPlatformOwner("/clients/display");
  const query = await searchParams;
  const [boards, tokens] = await Promise.all([getBoardDisplayGroups(), listDisplayTokens()]);
  const groups = [...new Set(boards.map((board) => board.displayGroup).filter(Boolean))] as string[];

  return (
    <>
      <ProtectedSessionBar backHref="/clients" backLabel="Back to clients" title="Display groups" />
      <main className="shell focus-client-hub">
        <section className="focus-client-hub-hero">
          <p className="focus-kicker">Ambient display</p>
          <h1>Display groups and links.</h1>
          <p>
            Put boards into a group, then create a display link for that group. The link opens the
            group dashboard without a login, so treat it like a password and revoke it if a device is
            lost.
          </p>
          {query.message ? <p className="form-success">{query.message}</p> : null}
          {query.error ? <p className="form-error">{query.error}</p> : null}
        </section>

        <section className="focus-client-grid">
          <article className="focus-client-card focus-public-page-neon focus-theme-neon">
            <div className="focus-client-card-head">
              <div>
                <p className="focus-client-label">Step 1</p>
                <h2>Boards in groups</h2>
              </div>
            </div>
            {boards.map((board) => (
              <form action={setBoardDisplayGroupAction} className="focus-control-form" key={board.boardKey}>
                <input name="boardKey" type="hidden" value={board.boardKey} />
                <label className="field">
                  <span>
                    {board.displayName}
                    {board.status === "active" ? "" : " (inactive, never shown)"}
                  </span>
                  <input
                    defaultValue={board.displayGroup ?? ""}
                    list="display-groups-admin"
                    name="displayGroup"
                    placeholder="No group"
                  />
                </label>
                <button className="button" type="submit">
                  Save
                </button>
              </form>
            ))}
            <datalist id="display-groups-admin">
              {groups.map((group) => (
                <option key={group} value={group} />
              ))}
            </datalist>
          </article>

          <article className="focus-client-card focus-public-page-neon focus-theme-neon">
            <div className="focus-client-card-head">
              <div>
                <p className="focus-client-label">Step 2</p>
                <h2>Create a display link</h2>
              </div>
            </div>
            <DisplayTokenForm groups={groups} />
          </article>

          <article className="focus-client-card focus-public-page-neon focus-theme-neon">
            <div className="focus-client-card-head">
              <div>
                <p className="focus-client-label">Links</p>
                <h2>Existing links</h2>
              </div>
            </div>
            {tokens.length === 0 ? <p>No display links yet.</p> : null}
            {tokens.map((token) => (
              <form action={revokeDisplayTokenAction} className="focus-control-form" key={token.id}>
                <input name="tokenId" type="hidden" value={token.id} />
                <p>
                  <strong>{token.displayGroup}</strong>
                  {token.label ? ` - ${token.label}` : ""}
                  <br />
                  Created {formatDate(token.createdAt)}, last used {formatDate(token.lastUsedAt)}
                  {token.revokedAt ? `, revoked ${formatDate(token.revokedAt)}` : ""}
                </p>
                {token.revokedAt ? null : (
                  <>
                    <Link className="button" href={`/display/${token.displayGroup}`}>
                      Preview group
                    </Link>
                    <button className="button" type="submit">
                      Revoke
                    </button>
                  </>
                )}
              </form>
            ))}
          </article>
        </section>
      </main>
    </>
  );
}
