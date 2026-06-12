import { getCurrentProfile, getSessionUser } from "@/lib/auth/session";
import type { StaffRole } from "@/lib/auth/types";

type OwnerApiAccess =
  | { allowed: true }
  | { allowed: false; error: string; status: 401 | 403 };

export async function getRoleApiAccess(
  allowedRoles: StaffRole[],
  deniedMessage = "You do not have permission to access this area.",
): Promise<OwnerApiAccess> {
  const user = await getSessionUser();

  if (!user) {
    return {
      allowed: false,
      error: "Sign in with the owner account to continue.",
      status: 401,
    };
  }

  const profile = await getCurrentProfile();

  if (!profile || !allowedRoles.includes(profile.role)) {
    return {
      allowed: false,
      error: deniedMessage,
      status: 403,
    };
  }

  return { allowed: true };
}

export async function getOwnerApiAccess(): Promise<OwnerApiAccess> {
  return getRoleApiAccess(
    ["owner"],
    "Only the owner account can access Focus administration.",
  );
}
