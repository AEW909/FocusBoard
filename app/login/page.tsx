import { redirect } from "next/navigation";
import { getSafeNextPath } from "@/lib/auth/redirects";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = getSafeNextPath(params.next);
  const query = nextPath === "/" ? "" : `?next=${encodeURIComponent(nextPath)}`;

  redirect(`/${query}`);
}
