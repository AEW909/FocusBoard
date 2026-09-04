"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

type LoginFormProps = {
  nextPath: string;
};

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    const email = formData.get("email");
    const password = formData.get("password");

    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password.trim()) {
      setError("Enter your email and password.");
      return;
    }

    setPending(true);
    setError("");

    try {
      const { error: signInError } = await authClient.signIn.email({
        email: email.trim(),
        password: password.trim(),
      });

      if (signInError) {
        setError(signInError.message ?? "Sign in failed. Please try again.");
        return;
      }

      router.push(nextPath === "/" ? "/" : `/?next=${encodeURIComponent(nextPath)}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="auth-form"
      action={async (formData) => {
        await handleSubmit(formData);
      }}
    >
      <input type="hidden" name="next" value={nextPath} />

      <label className="field">
        <span>Team email</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>

      <label className="field">
        <span>Password</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>

      {error ? <p className="form-error">{error}</p> : null}

      <button className="button button-primary" type="submit" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
