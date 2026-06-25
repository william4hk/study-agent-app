import { NextResponse } from "next/server";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModelV3Prompt } from "@ai-sdk/provider";
import { createClient } from "@/lib/supabase";

const modelId = "claude-sonnet-4-5";
function buildSystemPrompt({ subject, concept, row }: {
  subject: string;
  concept: string;
  row?: {
    mastery_level: string | null;
    weak_areas: string | null;
    strong_areas: string | null;
  };
}) {
  const subjectPart = subject ? `Subject: ${subject}.` : "";
  const conceptPart = concept ? `Concept: ${concept}.` : "";
  const contextParts: string[] = [];

  if (row?.weak_areas) {
    contextParts.push(`Weak areas: ${row.weak_areas}.`);
  }
  if (row?.strong_areas) {
    contextParts.push(`Strong areas: ${row.strong_areas}.`);
  }

  const contextText = contextParts.length > 0 ? `${contextParts.join(" ")} Use these to tailor your explanation.` : "";

  let modeInstruction = "";
  if (!row) {
    modeInstruction = "You are teaching a beginner-friendly explanation that leads with analogy and defines all terms clearly.";
  } else if (row.mastery_level === "Introduced" || row.mastery_level === "Developing") {
    modeInstruction = "Reference prior knowledge, call out weak areas, and keep the pace moderate.";
  } else if (row.mastery_level === "Proficient" || row.mastery_level === "Strong") {
    modeInstruction = "Use a technical style, skip basic definitions, and focus on nuance and deeper insight.";
  } else {
    modeInstruction = "Adapt your explanation to the learner and emphasize clarity.";
  }

  return [
    "You are a thoughtful educational tutor.",
    subjectPart,
    conceptPart,
    modeInstruction,
    contextText,
    "Answer the user question directly and keep the focus on the requested concept."
  ]
    .filter(Boolean)
    .join(" ");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const userMessage = typeof body.userMessage === "string" ? body.userMessage.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const concept = typeof body.concept === "string" ? body.concept.trim() : "";

  if (!userMessage) {
    return NextResponse.json({ error: "Missing userMessage." }, { status: 400 });
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    return NextResponse.json(
      { error: "Missing ANTHROPIC_API_KEY environment variable." },
      { status: 500 }
    );
  }

  const anthropic = createAnthropic({ apiKey: anthropicApiKey });

  let conceptRow: { mastery_level: string | null; weak_areas: string | null; strong_areas: string | null } | undefined;

  if (subject && concept) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("concepts")
      .select("mastery_level, weak_areas, strong_areas")
      .eq("subject", subject)
      .eq("concept", concept)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Supabase query failed.", details: error.message }, { status: 500 });
    }

    if (data) {
      conceptRow = {
        mastery_level: data.mastery_level ?? null,
        weak_areas: data.weak_areas ?? null,
        strong_areas: data.strong_areas ?? null
      };
    }
  }

  const systemPrompt = buildSystemPrompt({ subject, concept, row: conceptRow });
  const prompt: LanguageModelV3Prompt = [
    { role: "system", content: systemPrompt },
    { role: "user", content: [{ type: "text", text: userMessage }] }
  ];

  const model = anthropic(modelId);
  let response;
  try {
    response = await model.doStream({ prompt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Anthropic error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const outputStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = response.stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (value.type === "text-delta") {
            controller.enqueue(encoder.encode(value.delta));
          } else if (value.type === "error") {
            controller.error(value.error ?? new Error("Stream error from Anthropic."));
            return;
          }
        }
      } catch (error) {
        controller.error(error);
      } finally {
        controller.close();
      }
    }
  });

  return new NextResponse(outputStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}
