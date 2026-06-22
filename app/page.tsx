import { redirect } from "next/navigation";
import { FocusLoginScreen } from "@/components/auth/focus-login-screen";
import { getSafeNextPath } from "@/lib/auth/redirects";
import {
  getCurrentFocusBoardAccess,
  getFocusBoardHomePath,
} from "@/lib/focus-board/access";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const nextPath = getSafeNextPath(params.next);
  const current = await getCurrentFocusBoardAccess();

  if (!current) {
    return <FocusLoginScreen nextPath={nextPath} />;
  }

  const homePath = getFocusBoardHomePath(current.access);
  const destination = homePath === "/no-board" ? homePath : nextPath !== "/" ? nextPath : homePath;

  redirect(destination);
}
