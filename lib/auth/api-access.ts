import { getCurrentProfile, getSessionUser } from "@/lib/auth/session";

type OwnerApiAccess =
  | { allowed: true }
  | { allowed: false; error: string; status: 401 | 403 };

export async function getOwnerApiAccess(): Promise<OwnerApiAccess> {
  const user = await getSessionUser();

  if (!user) {
    return {
      allowed: false,
      error: "Sign in with the owner account to continue.",
      status: 401,
    };
  }

  const profile = await getCurrentProfile();

  if (!profile || profile.role !== "owner") {
    return {
      allowed: false,
      error: "Only the owner account can access Focus administration.",
      status: 403,
    };
  }

  return { allowed: true };
}
