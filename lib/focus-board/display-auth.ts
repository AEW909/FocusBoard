import { getCurrentFocusBoardAccess } from "@/lib/focus-board/access";
import { resolveDisplayToken } from "@/lib/focus-board/display-tokens";

// A display group may be viewed with a valid token for that exact group, or by a platform owner
// session (used for previews from the admin page). Nothing else is accepted.
export async function canViewDisplayGroup(group: string, token: string | null | undefined) {
  if (!group) {
    return false;
  }

  if (token) {
    const resolved = await resolveDisplayToken(token);

    if (resolved && resolved.group === group) {
      return true;
    }
  }

  const current = await getCurrentFocusBoardAccess();
  return Boolean(current?.access.isPlatformOwner);
}
