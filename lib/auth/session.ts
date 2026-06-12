import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { StaffProfile, StaffRole } from "@/lib/auth/types";

export async function getSessionUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function requireUser() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function getCurrentProfile(): Promise<StaffProfile | null> {
  const user = await getSessionUser();

  if (!user) return null;

  const supabase = await createSupabaseServerClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) {
    return profile satisfies StaffProfile;
  }

  const admin = createSupabaseAdminClient();
  const { data: adminProfile } = await admin
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (adminProfile) {
    return adminProfile satisfies StaffProfile;
  }

  if (error) {
    console.error("Profile lookup failed:", error);
  }

  return null;
}

export async function requireRole(allowedRoles: StaffRole[]) {
  await requireUser();
  const profile = await getCurrentProfile();

  if (!profile || !allowedRoles.includes(profile.role)) {
    redirect("/");
  }

  return profile satisfies StaffProfile;
}
