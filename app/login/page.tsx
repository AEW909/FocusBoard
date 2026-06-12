import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { getSafeNextPath } from "@/lib/auth/redirects";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = getSafeNextPath(params.next);

  return (
    <main className="auth-shell auth-shell-focus">
      <section className="auth-card auth-card-focus">
        <div className="auth-focus-orb auth-focus-orb-teal" aria-hidden="true" />
        <div className="auth-focus-orb auth-focus-orb-pink" aria-hidden="true" />
        <div className="auth-focus-orb auth-focus-orb-lime" aria-hidden="true" />

        <div className="auth-focus-brand">
          <div className="brand-mark" aria-hidden="true">
            <span className="brand-dot brand-dot-teal" />
            <span className="brand-dot brand-dot-sage" />
            <span className="brand-dot brand-dot-stone" />
          </div>
          <p className="auth-focus-brand-name">FocusBoard</p>
        </div>

        <p className="focus-kicker">Protected Access</p>
        <h1>Sign in to the control side.</h1>
        <p className="focus-hero-copy">
          The public board stays open, but the content lab and admin tools only unlock for
          signed-in team accounts.
        </p>
        <div className="auth-focus-badges">
          <span>Content Lab</span>
          <span>Control Room</span>
          <span>Shared Supabase</span>
        </div>
        <Suspense>
          <LoginForm nextPath={nextPath} />
        </Suspense>
      </section>
    </main>
  );
}
