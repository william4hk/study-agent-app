import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const supabase = createClient();
  try {
    const { count, error } = await supabase.from("concepts").select("id", { count: "exact", head: true });
    if (error) {
      return NextResponse.json({ error: "Failed to fetch progress.", details: error.message }, { status: 500 });
    }
    return NextResponse.json({ count: count ?? 0 });
  } catch (err) {
    return NextResponse.json({ error: "Unexpected error fetching progress." }, { status: 500 });
  }
}
