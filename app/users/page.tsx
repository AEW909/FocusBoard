import Link from "next/link";
import { ProtectedSessionBar } from "@/components/auth/protected-session-bar";
import { createFocusUserAction } from "@/app/users/actions";
import {
  getManagedFocusClients,
  requireFocusPlatformOwner,
} from "@/lib/focus-board/access";
import { getManagedFocusUsers } from "@/lib/focus-board/users";

export const dynamic = "force-dynamic";

type UsersPageProps = {
  searchParams: Promise<{
    userMessage?: string;
    userError?: string;
  }>;
};

function formatRole(role: "client_admin" | "client_user") {
  return role === "client_admin" ? "Client admin" : "Client user";
}

function formatDate(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  await requireFocusPlatformOwner("/users");
  const query = await searchParams;
  const [clients, users] = await Promise.all([
    getManagedFocusClients(),
    getManagedFocusUsers(),
  ]);

  return (
    <>
      <ProtectedSessionBar backHref="/clients" backLabel="Back to clients" title="User Management" />
      <main className="shell focus-client-hub focus-user-management">
        <section className="focus-client-hub-hero">
          <p className="focus-kicker">Platform workspace</p>
          <h1>Create and assign users.</h1>
          <p>
            FocusBoard now owns board access from inside the app. Auth still lives in the shared
            Supabase project, so this screen creates the login and then maps board access through
            FocusBoard memberships.
          </p>
        </section>

        <section className="focus-client-create-card">
          <div className="focus-client-create-copy">
            <p className="focus-kicker">New login</p>
            <h2>Create a FocusBoard user</h2>
            <p>
              Set the first password here and optionally assign the user to their first board
              immediately.
            </p>
          </div>

          {query.userMessage ? <p className="form-success">{query.userMessage}</p> : null}
          {query.userError ? <p className="form-error">{query.userError}</p> : null}

          <form action={createFocusUserAction} className="focus-client-create-form">
            <div className="focus-control-two-up">
              <label className="field">
                <span>Full name</span>
                <input name="fullName" placeholder="Example: Liona Harris" />
              </label>
              <label className="field">
                <span>Email</span>
                <input name="email" placeholder="name@example.com" required type="email" />
              </label>
            </div>

            <div className="focus-control-two-up">
              <label className="field">
                <span>Initial password</span>
                <input
                  name="password"
                  placeholder="At least 8 characters"
                  required
                  type="password"
                />
              </label>
              <label className="field">
                <span>First board assignment (optional)</span>
                <select className="select-field" defaultValue="" name="clientId">
                  <option value="">No board yet</option>
                  {clients.map((client) => (
                    <option key={client.clientId} value={client.clientId}>
                      {client.displayName}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="focus-control-two-up">
              <label className="field">
                <span>Initial role</span>
                <select className="select-field" defaultValue="client_user" name="role">
                  <option value="client_user">Client user</option>
                  <option value="client_admin">Client admin</option>
                </select>
              </label>
              <label className="field">
                <span>Content Lab on first board</span>
                <select className="select-field" defaultValue="false" name="contentLabAccess">
                  <option value="false">Disabled</option>
                  <option value="true">Enabled</option>
                </select>
              </label>
            </div>

            <button className="button focus-client-manage-button" type="submit">
              Create user
            </button>
          </form>
        </section>

        <section className="focus-client-grid">
          {users.map((managedUser) => (
            <article className="focus-client-card" key={managedUser.userId}>
              <div className="focus-client-card-head">
                <div>
                  <p className="focus-client-label">User</p>
                  <h2>{managedUser.fullName ?? managedUser.email}</h2>
                  <p className="focus-user-card-email">{managedUser.email}</p>
                </div>
                <span
                  className={`focus-client-status ${
                    managedUser.isPlatformOwner
                      ? "focus-client-status-active"
                      : "focus-client-status-inactive"
                  }`}
                >
                  {managedUser.isPlatformOwner ? "platform owner" : "shared auth"}
                </span>
              </div>

              <div className="focus-client-features">
                <span>
                  {managedUser.memberships.length === 1
                    ? "1 board assignment"
                    : `${managedUser.memberships.length} board assignments`}
                </span>
                <span>Created {formatDate(managedUser.createdAt)}</span>
              </div>

              {managedUser.memberships.length > 0 ? (
                <div className="focus-user-membership-list">
                  {managedUser.memberships.map((membership) => (
                    <div className="focus-user-membership-item" key={membership.membershipId}>
                      <div>
                        <strong>{membership.displayName}</strong>
                        <p>
                          /board/{membership.boardSlug} · {formatRole(membership.role)}
                        </p>
                        <p>
                          {membership.isActive ? "Active access" : "Inactive access"} · Content Lab{" "}
                          {membership.contentLabAccess ? "enabled" : "disabled"}
                        </p>
                      </div>
                      <Link
                        className="button focus-client-open-button"
                        href={`/clients/${membership.clientId}/manage`}
                      >
                        Manage
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="focus-membership-empty">
                  No FocusBoard board access yet. Create the login here, then attach boards when
                  needed.
                </p>
              )}
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
