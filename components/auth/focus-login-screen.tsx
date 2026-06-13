import { Suspense } from "react";
import Image from "next/image";
import { signOutAction } from "@/app/login/actions";
import { LoginForm } from "@/components/auth/login-form";

type FocusLoginScreenProps = {
  nextPath: string;
  signedInEmail?: string;
};

export function FocusLoginScreen({
  nextPath,
  signedInEmail,
}: FocusLoginScreenProps) {
  return (
    <main className="auth-shell auth-shell-focus">
      <section className="auth-card auth-card-focus">
        <div className="auth-focus-orb auth-focus-orb-teal" aria-hidden="true" />
        <div className="auth-focus-orb auth-focus-orb-pink" aria-hidden="true" />
        <div className="auth-focus-orb auth-focus-orb-lime" aria-hidden="true" />

        <div className="auth-focus-brand">
          <div className="brand-mark brand-mark-mascot" aria-hidden="true">
            <Image alt="" height={44} priority src="/focus/mascot-rainbow.svg" width={44} />
          </div>
          <p className="auth-focus-brand-name">FocusBoard</p>
        </div>

        <p className="focus-kicker">Tiny wins. Real momentum.</p>
        <h1>Sign in to your board.</h1>
        <p className="focus-hero-copy">
          Your weekly goals, points, rewards, and optional content tools live here.
        </p>
        <div className="auth-focus-badges">
          <span>Weekly focus</span>
          <span>Progress</span>
          <span>Rewards</span>
        </div>

        {signedInEmail ? (
          <div className="auth-focus-no-access">
            <p>
              <strong>{signedInEmail}</strong> is signed in, but it does not currently have an
              active FocusBoard assignment.
            </p>
            <form action={signOutAction}>
              <button className="button button-primary" type="submit">
                Sign out and use another account
              </button>
            </form>
          </div>
        ) : (
          <Suspense>
            <LoginForm nextPath={nextPath} />
          </Suspense>
        )}
      </section>
    </main>
  );
}
