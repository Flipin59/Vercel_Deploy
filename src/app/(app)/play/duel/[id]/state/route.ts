import { getDuelView } from "@/features/play/duelStore";

// The duel as the signed-in player sees it, polled about once a second by the arena.
export async function GET(_req: Request, ctx: RouteContext<"/play/duel/[id]/state">) {
  const view = await getDuelView((await ctx.params).id);
  if (!view) return new Response(null, { status: 404 });
  return Response.json(view, { headers: { "Cache-Control": "no-store" } });
}
