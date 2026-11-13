'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Spotlight } from '@/components/onboarding/Spotlight';

/**
 * Visite guidée du compte « point de vente » : à sa première connexion, le projecteur montre
 * un à un chaque élément de son espace et explique à quoi il sert, pour qu'il le maîtrise
 * sans formation. Relançable à tout moment (« Revoir la visite guidée »).
 * Mémorisée sur l'appareil, par compte.
 */

interface TourStep {
  target: string;
  title: string;
  text: string;
  /** Écran concerné : ordinateur (menu latéral) ou mobile (barre du bas). Par défaut : les deux. */
  only?: 'desktop' | 'mobile';
}

const STEPS: TourStep[] = [
  {
    target: 'pos:header',
    title: 'Bienvenue dans votre espace',
    text: 'Ici, vous suivez tout ce qui concerne votre point de vente : les tickets reçus, l’argent collecté et vos commissions. Suivez le guide, il ne prend qu’une minute.',
  },
  {
    target: 'pos:readonly',
    title: 'Consultation seule',
    text: 'Vous consultez vos informations, vous ne pouvez rien modifier. Les allocations et les collectes sont saisies par votre fournisseur ou son collecteur.',
  },
  {
    target: 'pos:period',
    title: 'Choisissez la période',
    text: 'Ce mois-ci, 3 derniers mois, cette année ou depuis le début : les chiffres juste en dessous s’adaptent à la période choisie.',
  },
  {
    target: 'pos:kpis',
    title: 'Vos chiffres clés',
    text: 'Tickets reçus, total collecté chez vous, écart entre l’attendu et le collecté (en rouge s’il manque de l’argent) et votre commission. Touchez une tuile pour voir le détail.',
  },
  {
    target: 'pos:collections',
    title: 'Vos 5 dernières collectes',
    text: 'Chaque passage du collecteur : la date, le montant collecté, votre commission et l’écart éventuel. Touchez une collecte pour voir les tickets vendus.',
  },
  {
    target: 'pos:tickets',
    title: 'Vos 5 derniers tickets reçus',
    text: 'Les tickets que votre fournisseur vous a confiés, par type (Pass 1h, Pass 24h…). C’est votre stock à vendre.',
  },
  {
    target: 'nav:/allocations',
    title: 'Mes allocations',
    text: 'L’historique complet de tous les tickets reçus, avec la valeur de votre stock.',
  },
  {
    target: 'nav:/collections',
    title: 'Mes collectes',
    text: 'Toutes les collectes faites dans votre point de vente, avec les montants et les écarts.',
  },
  {
    target: 'nav:/commissions',
    title: 'Mes commissions',
    text: 'Toutes vos commissions, votre moyenne, la plus élevée, votre « mois de bonheur » et un graphique mois par mois.',
  },
  {
    target: 'nav:/support',
    title: 'Besoin d’aide ?',
    text: 'Écrivez au support depuis ce menu. Dans Paramètres, vous pouvez changer votre mot de passe.',
    only: 'desktop',
  },
  {
    target: 'nav:menu',
    title: 'Le menu',
    text: 'Support, paramètres (changer votre mot de passe) et déconnexion se trouvent ici.',
    only: 'mobile',
  },
];

/** Événement pour relancer la visite (bouton « Revoir la visite guidée »). */
export const POS_TOUR_EVENT = 'optispace:pos-tour';

const storageKey = (userId: string) => `optispace:pos-tour-vu:${userId}`;

export function PosAccountTour({ userId, ready }: { userId: string; ready: boolean }) {
  const [index, setIndex] = useState<number | null>(null);
  const [steps, setSteps] = useState<TourStep[]>([]);

  const start = useCallback(() => {
    // Menu latéral sur ordinateur (≥ 1024 px), barre du bas sur mobile
    const desktop = window.matchMedia('(min-width: 1024px)').matches;
    setSteps(STEPS.filter((s) => !s.only || s.only === (desktop ? 'desktop' : 'mobile')));
    setIndex(0);
  }, []);

  // Première connexion : la visite démarre d'elle-même une fois le tableau de bord affiché
  useEffect(() => {
    if (!ready) return;
    let seen = true;
    try {
      seen = localStorage.getItem(storageKey(userId)) === '1';
    } catch {
      /* stockage indisponible : pas de lancement automatique */
    }
    if (seen) return;
    const timer = setTimeout(start, 600);
    return () => clearTimeout(timer);
  }, [ready, userId, start]);

  // Relance à la demande
  useEffect(() => {
    window.addEventListener(POS_TOUR_EVENT, start);
    return () => window.removeEventListener(POS_TOUR_EVENT, start);
  }, [start]);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(storageKey(userId), '1');
    } catch {
      /* ignoré */
    }
    setIndex(null);
  }, [userId]);

  if (index === null || !steps[index]) return null;
  const step = steps[index];
  const last = index === steps.length - 1;

  return (
    <Spotlight
      key={step.target}
      target={step.target}
      step={`Étape ${index + 1} sur ${steps.length}`}
      title={step.title}
      text={step.text}
      onClose={finish}
      closeOnTargetClick={false}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <button type="button" onClick={finish} className="h-8 px-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            Passer
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex(index - 1)}
                className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Précédent
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? finish() : setIndex(index + 1))}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700"
            >
              {last ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Terminer
                </>
              ) : (
                <>
                  Suivant <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      }
    />
  );
}
