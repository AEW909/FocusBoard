import { notFound } from "next/navigation";
import { FocusContentLab } from "@/components/focus/focus-content-lab";
import { requireRole } from "@/lib/auth/session";
import { getFocusBoardRuntimeConfigByPublicSlug } from "@/lib/focus-board/runtime";

type FocusContentPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function FocusContentPage({ params }: FocusContentPageProps) {
  await requireRole(["owner"]);
  const { slug } = await params;
  const runtime = await getFocusBoardRuntimeConfigByPublicSlug(slug);

  if (!runtime) {
    notFound();
  }

  return <FocusContentLab slug={slug} />;
}
