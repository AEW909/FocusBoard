import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientContentProfiles } from "@/lib/db/schema";

export type FocusContentProfile = {
  businessName: string;
  brandVoice: string;
  targetAudience: string;
  services: string;
  differentiators: string;
  contentRules: string;
  updatedAt: string | null;
};

function normaliseText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function buildFallbackProfile(name: string): FocusContentProfile {
  return {
    businessName: name,
    brandVoice: "",
    targetAudience: "",
    services: "",
    differentiators: "",
    contentRules: "",
    updatedAt: null,
  };
}

export async function getFocusContentProfile(clientId: string, fallbackName: string) {
  const rows = await db
    .select()
    .from(clientContentProfiles)
    .where(eq(clientContentProfiles.clientId, clientId))
    .limit(1);

  const row = rows[0];

  if (!row) {
    return buildFallbackProfile(fallbackName);
  }

  return {
    businessName: normaliseText(row.businessName) || fallbackName,
    brandVoice: normaliseText(row.brandVoice),
    targetAudience: normaliseText(row.targetAudience),
    services: normaliseText(row.services),
    differentiators: normaliseText(row.differentiators),
    contentRules: normaliseText(row.contentRules),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : null,
  } satisfies FocusContentProfile;
}

export function buildFocusContentSystemPrompt(profile: FocusContentProfile) {
  const sections = [
    `You are a specialist copywriter for ${profile.businessName}.`,
    profile.brandVoice
      ? `BRAND VOICE:\n${profile.brandVoice}`
      : null,
    profile.targetAudience
      ? `TARGET AUDIENCE:\n${profile.targetAudience}`
      : null,
    profile.services
      ? `SERVICES / OFFERS:\n${profile.services}`
      : null,
    profile.differentiators
      ? `DIFFERENTIATORS:\n${profile.differentiators}`
      : null,
    profile.contentRules
      ? `CONTENT RULES:\n${profile.contentRules}`
      : null,
    "When generating content, produce only the finished copy. No preamble, no meta-commentary, and no explanation of what you are doing. Format clearly for the requested channel and content type.",
  ].filter(Boolean);

  return sections.join("\n\n");
}
