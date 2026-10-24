"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { focusBoardSettings } from "@/lib/db/schema";
import { requireFocusPlatformOwner } from "@/lib/focus-board/access";
import {
  createDisplayToken,
  normaliseDisplayGroup,
  revokeDisplayToken,
} from "@/lib/focus-board/display-tokens";

export type CreateTokenState = { path?: string; error?: string };

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function setBoardDisplayGroupAction(formData: FormData) {
  await requireFocusPlatformOwner("/clients/display");

  const boardKey = getValue(formData, "boardKey");
  const group = normaliseDisplayGroup(getValue(formData, "displayGroup"));

  if (!boardKey) {
    redirect("/clients/display?error=Choose%20a%20board.");
  }

  await db
    .update(focusBoardSettings)
    .set({ displayGroup: group || null })
    .where(eq(focusBoardSettings.boardKey, boardKey));

  revalidatePath("/clients/display");
  redirect("/clients/display?message=Display%20group%20saved.");
}

// Returns the display path once; the raw token is never stored and cannot be shown again.
export async function createDisplayTokenAction(
  _previous: CreateTokenState,
  formData: FormData,
): Promise<CreateTokenState> {
  const { user } = await requireFocusPlatformOwner("/clients/display");

  const group = normaliseDisplayGroup(getValue(formData, "displayGroup"));
  const label = getValue(formData, "label").slice(0, 60);

  if (!group) {
    return { error: "Enter a display group first." };
  }

  const { token } = await createDisplayToken({ group, label, userId: user.id });
  revalidatePath("/clients/display");

  return { path: `/display/${group}?dt=${token}` };
}

export async function revokeDisplayTokenAction(formData: FormData) {
  await requireFocusPlatformOwner("/clients/display");

  const id = getValue(formData, "tokenId");

  if (id) {
    await revokeDisplayToken(id);
  }

  revalidatePath("/clients/display");
  redirect("/clients/display?message=Token%20revoked.");
}
