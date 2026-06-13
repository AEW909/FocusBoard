import { ProtectedSessionBar } from "@/components/auth/protected-session-bar";

export default function Loading() {
  return (
    <>
      <ProtectedSessionBar title="Content Lab" />
      <main className="focus-content-shell">
        <div className="focus-content-container">
          <header className="focus-content-header">
            <div className="focus-content-logo-mark" aria-hidden="true">
              F
            </div>
            <h1>Loading...</h1>
            <p>Preparing Content Lab</p>
          </header>
        </div>
      </main>
    </>
  );
}
