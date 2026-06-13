import { createFocusBoardAdminClient } from "@/lib/focus-board/db";

export type FocusContentProfile = {
  businessName: string;
  brandVoice: string;
  targetAudience: string;
  services: string;
  differentiators: string;
  contentRules: string;
  updatedAt: string | null;
};

type FocusContentProfileRow = {
  business_name: string;
  brand_voice: string | null;
  target_audience: string | null;
  services: string | null;
  differentiators: string | null;
  content_rules: string | null;
  updated_at: string | null;
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
  const admin = createFocusBoardAdminClient();
  const { data, error } = await admin
    .from("client_content_profiles")
    .select(
      "business_name, brand_voice, target_audience, services, differentiators, content_rules, updated_at",
    )
    .eq("client_id", clientId)
    .maybeSingle<FocusContentProfileRow>();

  if (error) {
    throw new Error(`Failed to load client content profile: ${error.message}`);
  }

  if (!data) {
    return buildFallbackProfile(fallbackName);
  }

  return {
    businessName: normaliseText(data.business_name) || fallbackName,
    brandVoice: normaliseText(data.brand_voice),
    targetAudience: normaliseText(data.target_audience),
    services: normaliseText(data.services),
    differentiators: normaliseText(data.differentiators),
    contentRules: normaliseText(data.content_rules),
    updatedAt: data.updated_at,
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
