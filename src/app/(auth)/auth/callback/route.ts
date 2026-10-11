import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/shared/supabase/server";
import { isSupabaseConfigured } from "@/shared/supabase/config";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code && isSupabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.redirect(new URL("/login?error=verificationFailed", request.url));
}
