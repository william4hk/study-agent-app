import { NextResponse } from "next/server";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModelV3Prompt } from "@ai-sdk/provider";

const modelId = "claude-sonnet-4-5"
function parseConceptResponse(text: string) {
  try {
    const json = JSON.parse(text.trim());
    const subject = typeof json.subject === "string" ? json.subject : "";
    const concept = typeof json.concept === "string" ? json.concept : "";
    return { subject, concept };
  } catch {
    return { subject: "", concept: "" };
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const userMessage = typeof body.userMessage === "string" ? body.userMessage.trim() : "";
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

  const prompt: LanguageModelV3Prompt = [
    {
      role: "system",
      content:
        "You are a JSON extraction assistant. Extract the subject and concept from the user message and return only a JSON object with two string fields: subject and concept. If the message is not about studying a concept, return subject: '' and concept: ''. Do not add any additional text."
    },
    {
      role: "user",
      content: [{ type: "text", text: `User message: ${userMessage}` }]
    }
  ];

  const model = anthropic(modelId);
  let result;
  try {
    result = await model.doGenerate({ prompt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Anthropic error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const text = result.content
    .filter((part) => part.type === "text")
    .map((part) => part.type === "text" ? part.text : "")
    .join("");

  const extracted = parseConceptResponse(text);
  return NextResponse.json(extracted);
}
