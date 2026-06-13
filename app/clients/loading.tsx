import { ProtectedSessionBar } from "@/components/auth/protected-session-bar";

export default function Loading() {
  return (
    <>
      <ProtectedSessionBar title="Client Hub" />
      <main className="shell focus-client-hub">
        <section className="focus-client-hub-hero">
          <p className="focus-kicker">Platform workspace</p>
          <h1>Loading client boards...</h1>
          <p>Preparing the latest client list and provisioning controls.</p>
        </section>
      </main>
    </>
  );
}
