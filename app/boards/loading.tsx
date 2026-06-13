import { ProtectedSessionBar } from "@/components/auth/protected-session-bar";

export default function Loading() {
  return (
    <>
      <ProtectedSessionBar title="Your Boards" />
      <main className="shell focus-client-hub">
        <section className="focus-client-hub-hero">
          <p className="focus-kicker">Your workspace</p>
          <h1>Loading your boards...</h1>
          <p>Checking your active FocusBoard assignments.</p>
        </section>
      </main>
    </>
  );
}
