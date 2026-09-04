import { getSessionUser } from "@/lib/auth/session";
import { getFocusBoardAccessForUser } from "@/lib/focus-board/access";
import { getFocusBoardRuntimeConfigByPublicSlug } from "@/lib/focus-board/runtime";

type ApiAccess =
  | { allowed: true }
  | { allowed: false; error: string; status: 401 | 403 };

export async function getFocusPlatformOwnerApiAccess(): Promise<ApiAccess> {
  const user = await getSessionUser();

  if (!user) {
    return {
      allowed: false,
      error: "Sign in with the FocusBoard owner account to continue.",
      status: 401,
    };
  }

  const access = await getFocusBoardAccessForUser(user.id);

  if (!access.isPlatformOwner) {
    return {
      allowed: false,
      error: "Only the FocusBoard owner account can access this area.",
      status: 403,
    };
  }

  return { allowed: true };
}

export async function getFocusContentLabApiAccess(
  boardSlug: string,
): Promise<ApiAccess | { allowed: false; error: string; status: 404 }> {
  const user = await getSessionUser();

  if (!user) {
    return {
      allowed: false,
      error: "Sign in to continue.",
      status: 401,
    };
  }

  const runtime = await getFocusBoardRuntimeConfigByPublicSlug(boardSlug);

  if (!runtime) {
    return {
      allowed: false,
      error: "This content lab link is not valid.",
      status: 404,
    };
  }

  const access = await getFocusBoardAccessForUser(user.id);

  if (access.isPlatformOwner) {
    return { allowed: true };
  }

  const client = access.clients.find((item) => item.boardSlug === boardSlug);

  if (!client) {
    return {
      allowed: false,
      error: "You do not have access to this Content Lab.",
      status: 403,
    };
  }

  if (!client.contentLabEnabled) {
    return {
      allowed: false,
      error: "Content Lab is not enabled for this client.",
      status: 403,
    };
  }

  if (!client.canUseContentLab) {
    return {
      allowed: false,
      error: "This user is not assigned to the Content Lab for this client.",
      status: 403,
    };
  }

  return { allowed: true };
}
