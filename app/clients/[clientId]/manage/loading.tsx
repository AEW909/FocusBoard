import { ProtectedSessionBar } from "@/components/auth/protected-session-bar";

export default function Loading() {
  return (
    <>
      <ProtectedSessionBar backHref="/clients" backLabel="Back to clients" title="Control Room" />
      <main className="shell focus-public-page focus-public-page-neon focus-board-shell-neon focus-control-page">
        <section className="focus-arcade-hero focus-control-hero">
          <p className="focus-kicker">Secret focus control room</p>
          <h1>Loading controls...</h1>
          <p className="focus-hero-copy">Bringing in board settings, memberships, and content tools.</p>
        </section>
      </main>
    </>
  );
}
