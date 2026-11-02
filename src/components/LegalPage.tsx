import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { LEGAL_DOCS, UPDATED_AT, VERSION, type LegalDoc } from "@/lib/legal";

/** Met en évidence les mentions « [À COMPLÉTER : …] » à renseigner avant publication. */
function Text({ value }: { value: string }) {
  const parts = value.split(/(\[À COMPLÉTER[^\]]*\])/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("[À COMPLÉTER") ? (
          <mark key={i} className="rounded bg-amber-100 px-1 text-amber-900 print:bg-transparent print:text-inherit">
            {p}
          </mark>
        ) : (
          p
        ),
      )}
    </>
  );
}

export function LegalPage({ doc }: { doc: LegalDoc }) {
  const other = doc.slug === "cgu" ? LEGAL_DOCS.cgv : LEGAL_DOCS.cgu;

  return (
    <div className="min-h-screen bg-surface print:min-h-0 print:bg-white">
      <header className="bg-brand-950 text-white print:bg-white print:text-ink">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.jpg" alt="" width={34} height={34} className="rounded-xl" />
            <span className="text-lg font-extrabold tracking-tight">
              Opti<span className="text-brand-400 print:text-brand-600">Space</span>
            </span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/75 hover:text-white print:hidden">
            <ArrowLeft className="h-4 w-4" /> Retour au site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-12 sm:px-6 sm:py-16 print:py-6">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-brand-600">{doc.short}</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.02em] text-ink sm:text-4xl">{doc.title}</h1>
        <p className="mt-3 text-sm text-ink-soft">
          Version {VERSION} · Mise à jour le {UPDATED_AT}
        </p>
        <p className="mt-6 text-lg leading-relaxed text-ink-soft">{doc.intro}</p>

        <div className="mt-8 flex flex-wrap gap-3 print:hidden">
          <a
            href={doc.pdf}
            download
            className="inline-flex h-12 items-center gap-2 rounded-2xl bg-brand-500 px-5 font-bold text-brand-on transition hover:bg-brand-400"
          >
            <Download className="h-5 w-5" /> Télécharger les {doc.short} (PDF)
          </a>
          <Link
            href={`/${other.slug}`}
            className="inline-flex h-12 items-center gap-2 rounded-2xl px-5 font-semibold text-ink ring-1 ring-line transition hover:bg-surface-low"
          >
            <FileText className="h-5 w-5" /> Lire les {other.short}
          </Link>
        </div>

        <nav aria-label="Sommaire" className="mt-10 rounded-2xl bg-surface-low p-6 ring-1 ring-line print:hidden">
          <p className="text-sm font-bold uppercase tracking-wider text-ink-soft">Sommaire</p>
          <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {doc.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-[15px] text-ink hover:text-brand-600">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-12 space-y-10">
          {doc.sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-6">
              <h2 className="break-after-avoid text-xl font-bold tracking-tight text-ink">{s.title}</h2>
              <div className="mt-3 space-y-3 leading-relaxed text-ink-soft">
                {s.paragraphs?.map((p) => (
                  <p key={p}>
                    <Text value={p} />
                  </p>
                ))}
                {s.list && (
                  <ul className="list-disc space-y-1.5 pl-5 marker:text-brand-500">
                    {s.list.map((l) => (
                      <li key={l} className="break-inside-avoid">
                        <Text value={l} />
                      </li>
                    ))}
                  </ul>
                )}
                {s.after?.map((p) => (
                  <p key={p}>
                    <Text value={p} />
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-16 border-t border-line pt-6 text-sm text-ink-soft">
          OptiSpace — {doc.title}, version {VERSION} du {UPDATED_AT}.
        </p>
      </main>
    </div>
  );
}
