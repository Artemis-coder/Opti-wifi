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
    <div className="space-y-5 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <FileText className="size-6 text-muted" /> Conditions d’utilisation
        </h1>
        <p className="text-xs text-muted mt-0.5">Dernière mise à jour : {TERMS_UPDATED}</p>
      </div>

      {state &&
        (accepted ? (
          <div className="rounded-xl bg-success-soft px-4 py-3 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-success-soft-foreground shrink-0 mt-0.5" />
            <p className="text-sm text-success-soft-foreground">
              Vous avez accepté ces conditions le <strong>{when(accepted)}</strong>, à la création de votre compte.
              {state.acceptedVersion && state.acceptedVersion !== state.currentVersion &&
                ' Elles ont été mises à jour depuis : la version ci-dessous est celle en vigueur.'}
            </p>
          </div>
        ) : (
          <div className="rounded-xl bg-surface-secondary px-4 py-3 flex items-start gap-3">
            <Info className="w-5 h-5 text-muted shrink-0 mt-0.5" />
            <p className="text-sm text-foreground">
              En utilisant OptiSpace, vous acceptez les conditions d’utilisation ci-dessous.
            </p>
          </div>
        ))}

      <Card className="space-y-4 hover:shadow-xs py-8">
        <TermsContent />
      </Card>
    </div>
  );
}
