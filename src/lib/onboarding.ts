'use client';

// ============================================================
// OPTIWIFI - Guide de démarrage d'un nouvel espace client.
// Les étapes se cochent d'elles-mêmes d'après les données de l'organisation (zone, point de
// vente, types de tickets, allocation, collecte). Affiché à l'administrateur d'un espace créé
// il y a moins de 30 jours tant que la mise en place n'est pas terminée.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores/authStore';
import { useReadOnly } from '@/lib/stores/accessStore';
import { OFFLINE_EVENTS } from '@/lib/offline/store';

export type OnboardingStepId = 'space' | 'pos' | 'tickets' | 'allocation' | 'collection' | 'team';

export interface OnboardingStepDef {
  id: OnboardingStepId;
  title: string;
  /** Ce qu'il faut faire, en une phrase */
  description: string;
  /** Pourquoi cette étape (affiché sur l'écran concerné) */
  why: string;
  action: string;
  /** Écran où se fait l'étape */
  path: string;
  /** Le formulaire s'ouvre dans une fenêtre sur cet écran (sinon : page de formulaire) */
  opensForm: boolean;
  optional?: boolean;
}

export const ONBOARDING_STEPS: OnboardingStepDef[] = [
  {
    id: 'space',
    title: 'Créer votre zone',
    description: 'Votre espace Wi-Fi : le quartier ou le site où vous vendez vos tickets.',
    why: 'La zone regroupe vos points de vente. Donnez-lui un nom simple (ex. « Cocody Riviera »).',
    action: 'Créer ma zone',
    path: '/spaces',
    opensForm: true,
  },
  {
    id: 'pos',
    title: 'Ajouter un point de vente',
    description: 'La boutique, la cabine ou le kiosque qui revend vos tickets.',
    why: 'Chaque point de vente reçoit des tickets et vous reverse l’argent des ventes.',
    action: 'Ajouter un point de vente',
    path: '/pos',
    opensForm: true,
  },
  {
    id: 'tickets',
    title: 'Créer vos types de tickets',
    description: 'Vos forfaits Wi-Fi : durée (en jours ou en heures) et prix de vente.',
    why: 'Exemple : « Pass 24 h » à 200 FCFA, « Pass 30 jours » à 5 000 FCFA.',
    action: 'Créer un type de ticket',
    path: '/tickets',
    opensForm: true,
  },
  {
    id: 'allocation',
    title: 'Allouer des tickets',
    description: 'Indiquez combien de tickets de chaque type vous confiez à un point de vente.',
    why: 'Choisissez le point de vente, puis la quantité par type de ticket : c’est son stock à vendre.',
    action: 'Allouer des tickets',
    path: '/allocations/new',
    opensForm: false,
  },
  {
    id: 'collection',
    title: 'Enregistrer une collecte',
    description: 'Récupérez l’argent des ventes : l’application calcule le montant attendu.',
    why: 'Comptez les tickets restants au point de vente : les tickets vendus et le montant attendu sont calculés pour vous.',
    action: 'Faire une collecte',
    path: '/collections/new',
    opensForm: false,
  },
  {
    id: 'team',
    title: 'Ajouter un collecteur',
    description: 'Un membre de votre équipe qui fait les tournées et les collectes à votre place.',
    why: 'Facultatif : vous pouvez aussi faire vos collectes vous-même.',
    action: 'Ajouter un collecteur',
    path: '/users',
    opensForm: true,
    optional: true,
  },
];

export interface OnboardingStep extends OnboardingStepDef {
  done: boolean;
}

export interface OnboardingState {
  /** Guide à afficher (nouvel espace, mise en place non terminée) */
  active: boolean;
  steps: OnboardingStep[];
  /** Étapes obligatoires faites / total */
  doneCount: number;
  total: number;
  /** Prochaine étape obligatoire à faire (null : tout est fait) */
  current: OnboardingStep | null;
  allDone: boolean;
}

/** Un espace est « nouveau » pendant 30 jours après sa création */
const NEW_ORGANIZATION_DAYS = 30;
/** Événement : ouvrir le formulaire de l'étape sur l'écran affiché */
export const GUIDE_OPEN_EVENT = 'optispace:guide-open';

async function computeOnboarding(organizationId: string): Promise<OnboardingState> {
  const supabase = createClient();
  const count = async (table: string, filter?: [string, string]) => {
    let q = supabase.from(table).select('id', { count: 'exact', head: true });
    if (filter) q = q.eq(filter[0], filter[1]);
    const { count: n } = await q;
    return Number(n || 0);
  };
  const [org, spaces, pos, tickets, allocations, collections, collectors] = await Promise.all([
    supabase.from('organizations').select('created_at').eq('id', organizationId).maybeSingle(),
    count('wifi_spaces'),
    count('points_of_sale'),
    count('ticket_types'),
    count('ticket_allocations'),
    count('collections'),
    count('profiles', ['role', 'collecteur']),
  ]);
  const done: Record<OnboardingStepId, boolean> = {
    space: spaces > 0,
    pos: pos > 0,
    tickets: tickets > 0,
    allocation: allocations > 0,
    collection: collections > 0,
    team: collectors > 0,
  };
  const steps = ONBOARDING_STEPS.map((s) => ({ ...s, done: done[s.id] }));
  const required = steps.filter((s) => !s.optional);
  const doneCount = required.filter((s) => s.done).length;
  const allDone = doneCount === required.length;
  const createdAt = (org.data as { created_at?: string } | null)?.created_at;
  const isNew = !!createdAt && Date.now() - new Date(createdAt).getTime() < NEW_ORGANIZATION_DAYS * 24 * 3600 * 1000;
  return {
    active: isNew && !allDone,
    steps,
    doneCount,
    total: required.length,
    current: required.find((s) => !s.done) ?? null,
    allDone,
  };
}

let cache: { userId: string; state: OnboardingState } | null = null;

/**
 * Progression du guide pour l'administrateur connecté (null : pas de guide pour ce compte ou
 * chargement). Recalculée à chaque changement d'écran et après chaque modification.
 */
export function useOnboarding(): OnboardingState | null {
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();
  // Abonnement expiré : consultation seule, pas de guide (il invite à créer des données)
  const readOnly = useReadOnly();
  const eligible = !!user && user.role === 'administrateur' && !!user.organization_id && !readOnly;
  const [state, setState] = useState<OnboardingState | null>(eligible && cache?.userId === user?.id ? cache.state : null);

  useEffect(() => {
    if (!eligible || !user?.organization_id) return;
    let cancelled = false;
    const userId = user.id;
    const organizationId = user.organization_id;
    const load = () =>
      computeOnboarding(organizationId)
        .then((s) => {
          cache = { userId, state: s };
          if (!cancelled) setState(s);
        })
        .catch(() => {});
    void load();
    // Après une création (en ligne ou hors ligne) : progression recalculée
    window.addEventListener(OFFLINE_EVENTS.replicaUpdated, load);
    window.addEventListener(OFFLINE_EVENTS.dataChanged, load);
    window.addEventListener('focus', load);
    return () => {
      cancelled = true;
      window.removeEventListener(OFFLINE_EVENTS.replicaUpdated, load);
      window.removeEventListener(OFFLINE_EVENTS.dataChanged, load);
      window.removeEventListener('focus', load);
    };
  }, [eligible, user?.id, user?.organization_id, pathname]);

  return eligible ? state : null;
}

/**
 * Sur l'écran d'une étape : ouvre le formulaire quand on arrive depuis le guide
 * (?guide=ouvrir) ou quand on touche le bouton du bandeau d'étape.
 */
export function useGuideOpenForm(open: () => void): void {
  // Toujours la dernière version (elle dépend de l'état de la page, ex. limite du forfait)
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  });
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const url = new URL(window.location.href);
    if (url.searchParams.get('guide') === 'ouvrir') {
      url.searchParams.delete('guide');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      // Laisse la page s'afficher avant d'ouvrir le formulaire
      timer = setTimeout(() => openRef.current(), 400);
    }
    const onEvent = () => openRef.current();
    window.addEventListener(GUIDE_OPEN_EVENT, onEvent);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(GUIDE_OPEN_EVENT, onEvent);
    };
  }, []);
}

/** Lien vers l'écran d'une étape : le projecteur y montre où cliquer */
export function stepHref(step: OnboardingStepDef): string {
  return step.path;
}

/** Entrée du menu de l'écran d'une étape (ex. /allocations/new → /allocations) */
export function stepMenu(step: OnboardingStepDef): { href: string; label: string } {
  const labels: Record<string, string> = {
    '/spaces': 'Espaces Wi-Fi',
    '/pos': 'Points de Vente',
    '/tickets': 'Types de Tickets',
    '/allocations': 'Allocations Tickets',
    '/collections': 'Collectes & Caisses',
    '/users': 'Utilisateurs & Équipe',
  };
  const href = '/' + step.path.split('/')[1];
  return { href, label: labels[href] ?? '' };
}
