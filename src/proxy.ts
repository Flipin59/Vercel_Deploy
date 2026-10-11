import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPlacementRoute } from "@/features/auth/routing";
import { isSupabaseConfigured } from "@/shared/supabase/config";

export async function proxy(request: NextRequest) {
  const placement = isPlacementRoute(request.nextUrl.pathname, request.nextUrl.searchParams.get("context"));
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-finquest-placement", placement ? "1" : "0");
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });
  if (!isSupabaseConfigured()) return next();
  let response = next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          for (const { name, value } of cookies) request.cookies.set(name, value);
          requestHeaders.set("cookie", request.cookies.toString());
          response = next();
          for (const { name, value, options } of cookies) response.cookies.set(name, value, options);
        },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const protectedRoute = /^\/(dashboard|play|reels|learn|forum|profile|cohort|onboarding)(\/|$)/.test(path);
  let destination: string | null = !user && protectedRoute ? "/login" : null;
  // Layouts persist across client navigation, so enforce onboarding on each request.
  const duelPoll = /^\/play\/duel\/[^/]+\/state$/.test(path);
  if (user && protectedRoute && path !== "/onboarding" && !placement && !duelPoll) {
    try {
      const { data, error } = await supabase.from("profiles").select("onboarded_at").eq("id", user.id).single();
      if (error) console.error("[proxy] onboarding lookup", error);
      else if (!data.onboarded_at) destination = "/onboarding";
    } catch (error) {
      // Page/data-layer checks remain authoritative; a proxy lookup outage must
      // not prevent every authenticated request from reaching them.
      console.error("[proxy] onboarding lookup", error);
    }
  }
  if (destination) {
    const url = request.nextUrl.clone();
    url.pathname = destination;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  // Static media skips the auth round-trip: chapter page images and reel clips are
  // lesson content, not personal data, and must stay cacheable on slow connections.
  // So do the PWA files (service worker, offline page, manifest, icons).
  matcher: ["/((?!_next/static|_next/image|favicon.ico$|sw.js$|offline.html$|manifest.webmanifest$|icons/|media/|learn/[^/]+/pages/).*)"],
};
