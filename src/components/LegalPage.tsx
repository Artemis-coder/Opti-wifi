import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { LEGAL_META, formatLegalDate, legalAnchor, legalBlocks, type LegalDoc, type LegalSlug } from "@/lib/legal";

/**
 * Page CGU / CGV. Le texte vient du back-office (Site vitrine → CGU / CGV) ;
 * le PDF téléchargeable est généré à partir du même texte (src/app/legal/[file]/route.ts).
 */
export function LegalPage({ slug, doc }: { slug: LegalSlug; doc: LegalDoc }) {
  const meta = LEGAL_META[slug];
  const otherSlug: LegalSlug = slug === "cgu" ? "cgv" : "cgu";
  const other = LEGAL_META[otherSlug];
  const sections = doc.sections.map((s) => ({ ...s, id: legalAnchor(s.title) }));

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-brand-950 text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.jpg" alt="" width={34} height={34} className="rounded-xl" />
            <span className="text-lg font-extrabold tracking-tight">
              Opti<span className="text-brand-400">Space</span>
            </span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/75 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Retour au site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-12 sm:px-6 sm:py-16">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-brand-600">{meta.short}</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.02em] text-ink sm:text-4xl">{meta.title}</h1>
        <p className="mt-3 text-sm text-ink-soft">
          Version {doc.version} · Mise à jour le {formatLegalDate(doc.updated_at)}
        </p>
        <p className="mt-6 text-lg leading-relaxed text-ink-soft">{doc.intro}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={meta.pdf}
            download
            className="inline-flex h-12 items-center gap-2 rounded-2xl bg-brand-500 px-5 font-bold text-brand-on transition hover:bg-brand-400"
          >
            <Download className="h-5 w-5" /> Télécharger les {meta.short} (PDF)
          </a>
          <Link
            href={`/${otherSlug}`}
            className="inline-flex h-12 items-center gap-2 rounded-2xl px-5 font-semibold text-ink ring-1 ring-line transition hover:bg-surface-low"
          >
            <FileText className="h-5 w-5" /> Lire les {other.short}
          </Link>
        </div>

        <nav aria-label="Sommaire" className="mt-10 rounded-2xl bg-surface-low p-6 ring-1 ring-line">
          <p className="text-sm font-bold uppercase tracking-wider text-ink-soft">Sommaire</p>
          <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-[15px] text-ink hover:text-brand-600">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-12 space-y-10">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-6">
              <h2 className="text-xl font-bold tracking-tight text-ink">{s.title}</h2>
              <div className="mt-3 space-y-3 leading-relaxed text-ink-soft">
                {legalBlocks(s.body).map((b, i) =>
                  b.type === "p" ? (
                    <p key={i}>{b.text}</p>
                  ) : (
                    <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-brand-500">
                      {b.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-16 border-t border-line pt-6 text-sm text-ink-soft">
          OptiSpace — {meta.title}, version {doc.version} du {formatLegalDate(doc.updated_at)}.
        </p>
      </main>
    </div>
  );
}
