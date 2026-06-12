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
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Owner Access</p>
        <h1>Sign in to FocusBoard.</h1>
        <p className="lede">
          This workspace is for protected FocusBoard administration only. Public board pages
          stay open, but the control room and content tools require the owner account.
        </p>
        <Suspense>
          <LoginForm nextPath={nextPath} />
        </Suspense>
      </section>
    </main>
  );
}
