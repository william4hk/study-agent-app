import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const concept = typeof body.concept === "string" ? body.concept.trim() : "";
  const masteryLevel = typeof body.masteryLevel === "string" ? body.masteryLevel.trim() : "";
  const overviewGist = typeof body.overviewGist === "string" ? body.overviewGist.trim() : "";
  const deepDiveGist = isStringArray(body.deepDiveGist) ? body.deepDiveGist : [];
  const strongAreas = isStringArray(body.strongAreas) ? body.strongAreas : [];
  const weakAreas = isStringArray(body.weakAreas) ? body.weakAreas : [];
  const nextSteps = isStringArray(body.nextSteps) ? body.nextSteps : [];
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  if (!subject || !concept) {
    return NextResponse.json({ error: "subject and concept are required." }, { status: 400 });
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY." },
      { status: 500 }
    );
  }

  const supabase = createClient();
  const { error, data } = await supabase
    .from("concepts")
    .upsert(
      {
        subject,
        concept,
        mastery_level: masteryLevel,
        overview_gist: overviewGist,
        deep_dive_gist: deepDiveGist,
        strong_areas: strongAreas,
        weak_areas: weakAreas,
        next_steps: nextSteps,
        notes,
        last_updated: new Date().toISOString()
      },
      { onConflict: "subject,concept" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to save concept.", details: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, concept: data });
}
