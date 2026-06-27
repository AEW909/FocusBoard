"use server";

import { redirect } from "next/navigation";
import { requireFocusBoardAccessBySlug } from "@/lib/focus-board/access";
import { markFocusWeeklyRoundupSeen } from "@/lib/focus-board/roundup";

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function completeFocusWeeklyRoundupAction(formData: FormData) {
  const slug = getValue(formData, "slug");
  const weekKey = getValue(formData, "weekKey");
  const { user, client } = await requireFocusBoardAccessBySlug(slug, `/board/${slug}/roundup?week=${weekKey}`);

  await markFocusWeeklyRoundupSeen(user.id, client.boardKey, weekKey);
  redirect(`/board/${client.boardSlug}`);
}
