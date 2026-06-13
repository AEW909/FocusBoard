import { ProtectedSessionBar } from "@/components/auth/protected-session-bar";

export default function Loading() {
  return (
    <>
      <ProtectedSessionBar title="Loading board" />
      <main className="shell focus-public-page focus-public-page-neon">
        <section className="focus-arcade-hero">
          <p className="focus-kicker">Loading</p>
          <h1>Preparing your board...</h1>
          <p className="focus-hero-copy">Pulling goals, rewards, and the latest progress.</p>
        </section>
      </main>
    </>
  );
}
