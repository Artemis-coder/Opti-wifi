import { getLegal } from "@/lib/content";
import type { LegalSlug } from "@/lib/legal";
import { renderLegalPdf } from "@/lib/legal-pdf";

// PDF des CGU / CGV, généré à partir du texte en vigueur (back-office) ; régénéré au plus toutes les 60 s.
export const revalidate = 60;

const FILES: Record<string, LegalSlug> = { "optispace-cgu.pdf": "cgu", "optispace-cgv.pdf": "cgv" };

export function generateStaticParams() {
  return Object.keys(FILES).map((file) => ({ file }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const slug = FILES[file];
  if (!slug) return new Response("Introuvable", { status: 404 });
  const pdf = await renderLegalPdf(slug, await getLegal(slug));
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${file}"`,
    },
  });
}
