import { ProtectedSessionBar } from "@/components/auth/protected-session-bar";

export default function Loading() {
  return (
    <>
      <ProtectedSessionBar backHref="/clients" backLabel="Back to clients" title="User Management" />
      <main className="shell focus-client-hub">
        <section className="focus-client-hub-hero">
          <p className="focus-kicker">Platform workspace</p>
          <h1>Loading users...</h1>
          <p>Pulling shared-auth accounts and the latest FocusBoard access map.</p>
        </section>
      </main>
    </>
  );
}
