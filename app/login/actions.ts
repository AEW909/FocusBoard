"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { getSafeNextPath } from "@/lib/auth/redirects";

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}

type ActionState = {
  error?: string;
};

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function signInAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = readString(formData, "email");
  const password = readString(formData, "password");
  const nextPath = getSafeNextPath(readString(formData, "next"));

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  try {
    await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sign in failed.";
    return { error: message };
  }

  redirect(nextPath === "/" ? "/" : `/?next=${encodeURIComponent(nextPath)}`);
}
