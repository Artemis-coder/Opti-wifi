'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileText, Info } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { TermsContent, TERMS_UPDATED } from '@/components/legal/TermsContent';

interface TermsState {
  currentVersion: string;
  acceptedVersion: string | null;
  acceptedAt: string | null;
}

const when = (d: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));

/**
 * Menu « Conditions d'utilisation » de l'espace (administrateur et collecteur) : le texte en
 * vigueur, toujours consultable, et la date à laquelle le compte l'a accepté.
 */
export default function TermsPage() {
  const [state, setState] = useState<TermsState | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/account/terms', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => !cancelled && json?.data && setState(json.data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const accepted = state?.acceptedAt;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FileText className="w-6 h-6 text-brand-600" /> Conditions d’utilisation
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">Dernière mise à jour : {TERMS_UPDATED}</p>
      </div>

      {state &&
        (accepted ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30 px-4 py-3 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-900 dark:text-emerald-200">
              Vous avez accepté ces conditions le <strong>{when(accepted)}</strong>, à la création de votre compte.
              {state.acceptedVersion && state.acceptedVersion !== state.currentVersion &&
                ' Elles ont été mises à jour depuis : la version ci-dessous est celle en vigueur.'}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50 px-4 py-3 flex items-start gap-3">
            <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700 dark:text-slate-300">
              En utilisant OptiSpace, vous acceptez les conditions d’utilisation ci-dessous.
            </p>
          </div>
        ))}

      <Card className="p-6 sm:p-8 space-y-6 hover:shadow-xs">
        <TermsContent />
      </Card>
    </div>
  );
}
