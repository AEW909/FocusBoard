"use client";

import { useActionState } from "react";
import { signInAction } from "@/app/login/actions";

type LoginFormProps = {
  nextPath: string;
};

const initialState = {
  error: "",
};

export function LoginForm({ nextPath }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <form className="auth-form" action={formAction}>
      <input type="hidden" name="next" value={nextPath} />

      <label className="field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>

      <label className="field">
        <span>Password</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>

      {state.error ? <p className="form-error">{state.error}</p> : null}

      <button className="button button-primary" type="submit" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
