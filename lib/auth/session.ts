import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { getSafeNextPath } from "@/lib/auth/redirects";

export async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function requireUser(nextPath?: string) {
  const user = await getSessionUser();

  if (!user) {
    const safeNextPath = getSafeNextPath(nextPath, "/");
    redirect(safeNextPath === "/" ? "/" : `/?next=${encodeURIComponent(safeNextPath)}`);
  }

  return user;
}
