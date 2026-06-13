import Link from "next/link";
import { redirect } from "next/navigation";
import { ProtectedSessionBar } from "@/components/auth/protected-session-bar";
import {
  getCurrentFocusBoardAccess,
  getFocusBoardHomePath,
} from "@/lib/focus-board/access";

export const dynamic = "force-dynamic";

export default async function BoardsPage() {
  const current = await getCurrentFocusBoardAccess();

  if (!current) {
    redirect("/?next=%2Fboards");
  }

  if (current.access.isPlatformOwner) {
    redirect("/clients");
  }

  const directDestination = getFocusBoardHomePath(current.access);

  if (directDestination && directDestination !== "/boards") {
    redirect(directDestination);
  }

  return (
    <>
      <ProtectedSessionBar title="Your Boards" />
      <main className="shell focus-client-hub">
        <section className="focus-client-hub-hero">
          <p className="focus-kicker">Your workspace</p>
          <h1>Choose a board.</h1>
          <p>Your account is assigned to more than one active FocusBoard.</p>
        </section>

        <section className="focus-client-grid">
          {current.access.clients.map((client) => (
            <article className="focus-client-card" key={client.clientId}>
              <p className="focus-client-label">FocusBoard</p>
              <h2>{client.displayName}</h2>
              <div className="focus-client-actions">
                <Link
                  className="button focus-client-manage-button"
                  href={`/board/${client.boardSlug}`}
                >
                  Open board
                </Link>
                {client.contentLabEnabled && client.canUseContentLab ? (
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
      </main>
    </>
  );
}
