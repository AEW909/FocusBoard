import { notFound } from "next/navigation";
import { ProtectedSessionBar } from "@/components/auth/protected-session-bar";
import { FocusContentLab } from "@/components/focus/focus-content-lab";
import { requireRole } from "@/lib/auth/session";
import { getFocusBoardRuntimeConfigByPublicSlug } from "@/lib/focus-board/runtime";

type FocusContentPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function FocusContentPage({ params }: FocusContentPageProps) {
  const { slug } = await params;
  await requireRole(["owner", "clinician", "admin"], `/focus-content/${slug}`);
  const runtime = await getFocusBoardRuntimeConfigByPublicSlug(slug);

  if (!runtime) {
    notFound();
  }

  return (
    <>
      <ProtectedSessionBar
        homeHref={`/focus/${runtime.settings.boardSlug}`}
        title="Content Lab"
      />
      <FocusContentLab slug={slug} />
    </>
  );
}
