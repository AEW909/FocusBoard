import { NextResponse } from "next/server";
import { getFocusContentLabApiAccess } from "@/lib/auth/api-access";
import { getFocusBoardRuntimeConfigByPublicSlug } from "@/lib/focus-board/runtime";
import {
  buildFocusContentSystemPrompt,
  getFocusContentProfile,
} from "@/lib/focus-board/content-profiles";

type FocusContentPayload = {
  slug?: string;
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
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured." },
      { status: 500 },
    );
  }

  const { slug, channel, format, tone, topic } = (await request.json()) as FocusContentPayload;

  if (!slug) {
    return NextResponse.json({ error: "Board context is missing." }, { status: 400 });
  }

  const access = await getFocusContentLabApiAccess(slug);

  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  if (!channel || !format || !tone || !topic) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const runtime = await getFocusBoardRuntimeConfigByPublicSlug(slug);

  if (!runtime?.settings.clientId) {
    return NextResponse.json({ error: "This content lab link is not valid." }, { status: 404 });
  }

  const profile = await getFocusContentProfile(runtime.settings.clientId, runtime.settings.title);
  const systemPrompt = buildFocusContentSystemPrompt(profile);

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
        system: systemPrompt,
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
