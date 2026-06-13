import Link from "next/link";
import { ProtectedSessionBar } from "@/components/auth/protected-session-bar";
import {
  getManagedFocusClients,
  requireFocusPlatformOwner,
} from "@/lib/focus-board/access";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  await requireFocusPlatformOwner("/clients");
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
                <Link
                  className="button focus-client-open-button"
                  href={`/board/${client.boardSlug}`}
                >
                  Open board
                </Link>
                {client.contentLabEnabled ? (
                  <Link
                    className="button focus-client-content-button"
                    href={`/clients/${client.clientId}/content`}
                  >
                    Content Lab
                  </Link>
                ) : null}
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
