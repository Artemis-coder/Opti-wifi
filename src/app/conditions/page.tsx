import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { TermsContent, TERMS_UPDATED } from '@/components/legal/TermsContent';

export const metadata: Metadata = {
  title: 'Conditions d’utilisation — OptiSpace',
};

/** Conditions d'utilisation (page publique, acceptées à la création du compte). */
export default function ConditionsPage() {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-10">
      <article className="max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-10 space-y-6">
        <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700">
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Conditions d’utilisation</h1>
          <p className="text-sm text-slate-500">Dernière mise à jour : {TERMS_UPDATED}</p>
        </header>
        <TermsContent />
      </article>
    </main>
  );
}
