import Link from "next/link";
import { ProtectedSessionBar } from "@/components/auth/protected-session-bar";
import {
  createFocusClientAction,
  setFocusClientStatusAction,
} from "@/app/clients/client-actions";
import {
  getManagedFocusClients,
  requireFocusPlatformOwner,
} from "@/lib/focus-board/access";

export const dynamic = "force-dynamic";

type ClientsPageProps = {
  searchParams: Promise<{
    clientMessage?: string;
    clientError?: string;
  }>;
};

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  await requireFocusPlatformOwner("/clients");
  const query = await searchParams;
  const clients = await getManagedFocusClients();

  return (
    <>
      <ProtectedSessionBar title="Client Hub" />
      <main className="shell focus-client-hub">
        <section className="focus-client-hub-hero">
          <p className="focus-kicker">Platform workspace</p>
          <h1>Pick a client board.</h1>
          <p>
            Open the live board, tune its goals and rewards, or launch Content Lab when that
            feature is assigned.
          </p>
          <div className="focus-client-actions">
            <Link className="button focus-client-open-button" href="/users">
              User management
            </Link>
          </div>
        </section>

        <section className="focus-client-create-card">
          <div className="focus-client-create-copy">
            <p className="focus-kicker">Provision a new board</p>
            <h2>Create a client workspace</h2>
            <p>
              This creates a fresh board from the current starter template, generates unique board
              links, and can optionally link an existing login straight away.
            </p>
          </div>

          {query.clientMessage ? <p className="form-success">{query.clientMessage}</p> : null}
          {query.clientError ? <p className="form-error">{query.clientError}</p> : null}

          <form action={createFocusClientAction} className="focus-client-create-form">
            <label className="field">
              <span>Client / board name</span>
              <input name="displayName" placeholder="Example: Harris Physio" required />
            </label>
            <label className="field">
              <span>Initial user email (optional)</span>
              <input name="ownerEmail" placeholder="name@example.com" type="email" />
            </label>
            <label className="field">
              <span>Content Lab at launch</span>
              <select className="select-field" defaultValue="false" name="contentLabEnabled">
                <option value="false">Disabled</option>
                <option value="true">Enabled</option>
              </select>
            </label>
            <button className="button focus-client-manage-button" type="submit">
              Create client board
            </button>
          </form>
        </section>

        <section className="focus-client-grid">
          {clients.map((client) => (
            <article className="focus-client-card" key={client.clientId}>
              <div className="focus-client-card-head">
                <div>
                  <p className="focus-client-label">Client</p>
                  <h2>{client.displayName}</h2>
                </div>
                <span className={`focus-client-status focus-client-status-${client.status}`}>
                  {client.status}
                </span>
              </div>

              <div className="focus-client-features">
                <span>Focus board</span>
                <span className={client.contentLabEnabled ? "is-enabled" : "is-disabled"}>
                  Content Lab {client.contentLabEnabled ? "enabled" : "not assigned"}
                </span>
              </div>

              <div className="focus-client-actions">
                <Link
                  className="button focus-client-manage-button"
                  href={`/clients/${client.clientId}/manage`}
                >
                  Manage dashboard
                </Link>
                {client.status === "active" ? (
                  <Link
                    className="button focus-client-open-button"
                    href={`/board/${client.boardSlug}`}
                  >
                    Open board
                  </Link>
                ) : null}
                {client.status === "active" && client.contentLabEnabled ? (
                  <Link
                    className="button focus-client-content-button"
                    href={`/clients/${client.clientId}/content`}
                  >
                    Content Lab
                  </Link>
                ) : null}
                <form action={setFocusClientStatusAction}>
                  <input name="clientId" type="hidden" value={client.clientId} />
                  <input
                    name="nextStatus"
                    type="hidden"
                    value={client.status === "active" ? "inactive" : "active"}
                  />
                  <button className="button focus-client-open-button" type="submit">
                    {client.status === "active" ? "Deactivate" : "Reactivate"}
                  </button>
                </form>
              </div>
            </article>
          ))}
        </section>

        {clients.length === 0 ? (
          <section className="focus-client-empty">
            No FocusBoard clients have been provisioned yet.
          </section>
        ) : null}
      </main>
    </>
  );
}
