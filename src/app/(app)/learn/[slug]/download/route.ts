import { readPdf } from "@/features/learn/server";

// The chapter as a PDF for offline / classroom use, e.g. /learn/save-emergency-fund/download.
export async function GET(_req: Request, ctx: RouteContext<"/learn/[slug]/download">) {
  const pdf = await readPdf((await ctx.params).slug);
  if (!pdf) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(pdf.file), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdf.name}"`,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
