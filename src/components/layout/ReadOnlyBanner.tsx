'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, Eye, Lock } from 'lucide-react';
import { Card } from '@/components/ui/Card';

/**
 * Bandeau permanent de l'espace dont l'abonnement est expiré : les données restent
 * consultables, mais rien ne peut plus être ajouté ni modifié. « Renouveler mon abonnement »
 * mène au choix du forfait (page Abonnement), puis à la demande avec le paiement ; le
 * collecteur est invité à prévenir son administrateur.
 */
export function ReadOnlyBanner({ isAdmin, renewPending }: { isAdmin: boolean; renewPending: boolean }) {
  return (
    <div
      role="status"
      className="mb-6 rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-4"
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <span className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
          <Lock className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <p className="font-bold text-red-700 dark:text-red-300">Votre abonnement a expiré</p>
          <p className="text-sm text-red-900/80 dark:text-red-200/80 mt-0.5">
            <Eye className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
            Votre espace est en <strong>consultation seule</strong> : vous retrouvez toutes vos données, mais
            vous ne pouvez plus rien ajouter ni modifier.{' '}
            {isAdmin
              ? renewPending
                ? 'Votre demande de renouvellement est en cours de validation : l’accès complet revient dès son activation.'
                : 'Pensez à renouveler votre abonnement pour mieux profiter de l’outil.'
              : 'Prévenez l’administrateur de votre espace pour qu’il renouvelle l’abonnement.'}
          </p>
        </div>
      </div>

      {isAdmin && (
        <div className="flex shrink-0">
          {renewPending ? (
            <span className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200 text-sm font-semibold">
              <Clock className="w-4 h-4" /> Demande en attente
            </span>
          ) : (
            <Link
              href="/subscription#forfaits"
              className="inline-flex items-center justify-center h-10 px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold whitespace-nowrap transition-colors"
            >
              Renouveler mon abonnement
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/** Remplace une page de saisie (nouvelle collecte, allocation, échange) en consultation seule. */
export function ReadOnlyPage() {
  return (
    <Card className="max-w-lg mx-auto p-8 text-center space-y-4 hover:shadow-xs">
      <span className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
        <Lock className="w-7 h-7" />
      </span>
      <div className="space-y-1">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">Saisie indisponible</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          L’abonnement de votre espace a expiré : vous pouvez consulter vos données, mais plus en ajouter.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700"
      >
        <ArrowLeft className="w-4 h-4" /> Retour au tableau de bord
      </Link>
    </Card>
  );
}
