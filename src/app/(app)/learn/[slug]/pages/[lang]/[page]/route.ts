import { readPage } from "@/features/learn/server";

// A chapter page image, e.g. /learn/save-emergency-fund/pages/en/2.
export async function GET(_req: Request, ctx: RouteContext<"/learn/[slug]/pages/[lang]/[page]">) {
  const { slug, lang, page } = await ctx.params;
  const image = await readPage(slug, lang, page);
  if (!image) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(image), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" },
  });
}
