import { NextResponse } from "next/server";
import { getRoleApiAccess } from "@/lib/auth/api-access";

const SYSTEM_PROMPT = `You are a specialist copywriter for Skin Revive Aesthetics, a clinical aesthetics practice in Lancaster run by Liona Harris - an HCPC-registered physiotherapist with 15 years clinical experience and 3 years in aesthetics. The practice is based at 3-1-5 Health Club, Mannin Way, Lancaster. The website is skinreviveaesthetics.com.

BRAND VOICE:
- Warm, confident, reassuring - like advice from a trusted friend who happens to be an expert
- Knowledgeable and credible, never cold or corporate
- Friendly and personal - Liona is the face of the brand, not a faceless business
- Subtle sophistication - premium but never pretentious or exclusive
- Empowering - about feeling like the best version of yourself
- Education-led: inform and build confidence, never pressure or hard sell
- NEVER use: fear-based language, urgency tactics, discount-led messaging, anything that feels cheap or "beauty salon"

TARGET CLIENT:
- Women and men aged 40-55, professionals and business owners with disposable income
- They research carefully before spending - trust, credentials and expertise win them over
- They want natural results - refreshed, not "done"
- Time-poor - they value clarity and professionalism
- May be new to aesthetics or returning after a poor experience - reassurance is critical

KEY TREATMENTS:
- Anti-wrinkle injections (Botox-type) - natural, subtle, preventing the "frozen" look
- The Restore Protocol - Liona's signature programme for post-weight-loss facial recovery (ideal for GLP-1 medication users), combines PLLA, polynucleotides, and RF Microneedling
- RF Microneedling - skin resurfacing and collagen stimulation using Trimax platform
- Polynucleotides - advanced biostimulator for skin quality
- PLLA (Poly-L-Lactic Acid) - gradual collagen stimulation for volume and structure
- Dermal fillers
- Skin boosters
- Physiotherapy and sports massage (under Harris Physiotherapy)

UNIQUE DIFFERENTIATORS:
- Liona is HCPC-registered - a higher level of clinical accountability than most aesthetics practitioners
- 15 years as a physiotherapist gives her deep anatomical knowledge and safety expertise
- Trained on the Trimax platform (RF Microneedling, Near IR, Bipolar RF, Fractional RF)
- The Restore Protocol is a clinically considered, multi-modality programme - not just a single treatment
- Warm, non-intimidating environment at 3-1-5 Health Club

CONTENT RULES:
- Always refer to GLP-1 medication generically - never use brand names like Mounjaro or Ozempic in ad or website copy; use "GLP-1 medication" or "weight-loss medication"
- Never lead with price or discounts
- Always weave in clinical credibility where relevant
- Liona's name and personality should appear in copy where natural - this is a personal practice
- Avoid anything that feels like a hairdresser, nail bar, or budget beauty context
- Never shame or imply the client has a problem - frame around feeling confident and refreshed
- For Instagram/Facebook: use relevant hashtags at the end (tasteful, not spammy - 5-10 max)

When generating content, produce ONLY the finished copy - no preamble, no meta-commentary, no explanation of what you're doing. Just the content, ready to use. Format clearly for the requested channel and content type.`;

type FocusContentPayload = {
  channel?: string;
  format?: string;
  tone?: string;
  topic?: string;
};

type AnthropicErrorPayload = {
  type?: string;
  error?: {
    type?: string;
    message?: string;
  };
};

type AnthropicMessagePayload = AnthropicErrorPayload & {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
};

async function readAnthropicError(response: Response) {
  const text = await response.text();

  try {
    const payload = JSON.parse(text) as AnthropicErrorPayload;
    return payload.error?.message ?? payload.type ?? text;
  } catch {
    return text;
  }
}

export async function POST(request: Request) {
  const access = await getRoleApiAccess(
    ["owner", "clinician", "admin"],
    "Only signed-in staff accounts can use the Focus content lab.",
  );

  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured." },
      { status: 500 },
    );
  }

  const { channel, format, tone, topic } = (await request.json()) as FocusContentPayload;

  if (!channel || !format || !tone || !topic) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const userPrompt = `Channel: ${channel}
Content format: ${format}
Tone: ${tone}
Topic / brief: ${topic}

Please write the content now, ready to use.`;

  try {
    const model = "claude-sonnet-4-6";

    const modelResponse = await fetch(`https://api.anthropic.com/v1/models/${model}`, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });

    if (!modelResponse.ok) {
      const detail = await readAnthropicError(modelResponse);

      return NextResponse.json(
        {
          error: `Anthropic model lookup failed for ${model}.`,
          detail,
          note: "This usually means the API key's workspace cannot access that model, even though the route itself is wired correctly.",
        },
        { status: 502 },
      );
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: userPrompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await readAnthropicError(response);

      return NextResponse.json(
        { error: detail || `Anthropic returned status ${response.status}.` },
        { status: 502 },
      );
    }

    const data = (await response.json()) as AnthropicMessagePayload;
    const text = data.content?.find((block) => block.type === "text")?.text?.trim();

    if (!text) {
      return NextResponse.json({ error: "No content returned." }, { status: 502 });
    }

    return NextResponse.json({ content: text });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal server error.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
