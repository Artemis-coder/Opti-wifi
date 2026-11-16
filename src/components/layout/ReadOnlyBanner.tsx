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
      className="mb-6 rounded-xl bg-danger-soft p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-4"
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <span className="w-10 h-10 rounded-lg bg-danger-soft text-danger flex items-center justify-center shrink-0">
          <Lock className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-danger">Votre abonnement a expiré</p>
          <p className="text-sm text-danger mt-0.5">
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
            <span className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-warning-soft text-warning-soft-foreground text-sm font-semibold">
              <Clock className="w-4 h-4" /> Demande en attente
            </span>
          ) : (
            <Link
              href="/subscription#forfaits"
              className="inline-flex items-center justify-center h-10 px-5 rounded-xl bg-danger hover:bg-danger-hover text-danger-foreground text-sm font-semibold whitespace-nowrap transition-colors"
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
    <Card className="max-w-lg mx-auto text-center space-y-4 hover:shadow-xs py-8">
      <span className="w-14 h-14 rounded-xl bg-danger-soft text-danger flex items-center justify-center mx-auto">
        <Lock className="w-7 h-7" />
      </span>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">Saisie indisponible</h1>
        <p className="text-sm text-muted">
          L’abonnement de votre espace a expiré : vous pouvez consulter vos données, mais plus en ajouter.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:text-accent"
      >
        <ArrowLeft className="w-4 h-4" /> Retour au tableau de bord
      </Link>
    </Card>
  );
}
