"use server";

import { redirect } from "next/navigation";
import { getSafeNextPath } from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect(nextPath);
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
