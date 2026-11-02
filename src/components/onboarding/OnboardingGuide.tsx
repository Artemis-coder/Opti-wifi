'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Check, ChevronDown, ChevronUp, Compass, Lock, PartyPopper, Sparkles, X } from 'lucide-react';
import { buttonClassName } from '@/components/ui/Button';
import { Spotlight } from '@/components/onboarding/Spotlight';
import { useAuthStore } from '@/lib/stores/authStore';
import { cn } from '@/lib/utils/cn';
import {
  GUIDE_OPEN_EVENT,
  ONBOARDING_STEPS,
  stepHref,
  stepMenu,
  useOnboarding,
  type OnboardingState,
  type OnboardingStep,
} from '@/lib/onboarding';

// Préférences par utilisateur, sur cet appareil
const key = (name: 'welcome' | 'hidden' | 'progress', userId: string) => `optispace:onboarding-${name}:${userId}`;
const read = (name: 'welcome' | 'hidden' | 'progress', userId: string) =>
  typeof window === 'undefined' ? null : localStorage.getItem(key(name, userId));
const write = (name: 'welcome' | 'hidden' | 'progress', userId: string, value: string) => localStorage.setItem(key(name, userId), value);

declare global {
  interface Window {
    /** Fenêtre de bienvenue ouverte : l'invitation aux notifications attend */
    __optispaceWelcomeOpen?: boolean;
  }
}

function StepNumber({ step, index, current }: { step: OnboardingStep; index: number; current: boolean }) {
  return (
    <span
      className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
        step.done
          ? 'bg-emerald-500 text-white'
          : current
            ? 'bg-brand-600 text-white ring-4 ring-brand-100 dark:ring-brand-900/50'
            : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
      )}
    >
      {step.done ? <Check className="w-4 h-4" /> : step.optional ? '+' : index + 1}
    </span>
  );
}

// ── Bienvenue et projecteurs (guide interactif) ───────────────────────────

function WelcomeModal({ name, state, onDismiss }: { name?: string | null; state: OnboardingState; onDismiss: () => void }) {
  const required = state.steps.filter((s) => !s.optional);
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-950/60 p-3" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 shadow-2xl">
        <div className="bg-gradient-to-br from-brand-600 to-brand-800 text-white px-6 pt-6 pb-5 rounded-t-3xl relative">
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Fermer"
            className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-white/80 hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
          <Sparkles className="w-8 h-8 mb-3 text-amber-300" />
          <h2 id="welcome-title" className="text-xl font-bold">
            Bienvenue sur OptiSpace{name ? `, ${name.split(' ')[0]}` : ''} !
          </h2>
          <p className="mt-1 text-sm text-white/85">
            Votre espace est prêt. Voici ce que vous allez faire, dans l’ordre, pour commencer à suivre vos ventes de
            tickets. À chaque étape, le guide vous montre où cliquer.
          </p>
        </div>

        <ol className="px-6 py-5 space-y-4">
          {required.map((s, i) => (
            <li key={s.id} className="flex gap-3">
              <StepNumber step={s} index={i} current={state.current?.id === s.id} />
              <div className="min-w-0 pt-0.5">
                <p className="font-semibold text-slate-900 dark:text-white">{s.title}</p>
                <p className="text-sm text-slate-500">{s.description}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="px-6 -mt-1 text-xs text-slate-500">
          Ensuite, si vous travaillez en équipe, vous pourrez ajouter des collecteurs qui feront les tournées.
        </p>

        <div className="px-6 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] grid grid-cols-1 gap-2">
          <button type="button" onClick={onDismiss} className={buttonClassName({ className: 'h-12 font-semibold w-full' })}>
            C’est parti, montrez-moi <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Étape de l'écran affiché : son formulaire, ou la liste du menu correspondant (ex. /allocations) */
function stepForPath(pathname: string) {
  return ONBOARDING_STEPS.find((s) => s.path === pathname) ?? ONBOARDING_STEPS.find((s) => stepMenu(s).href === pathname);
}

/** Élément du guide affiché à l'écran (le menu latéral est caché hors de l'écran sur mobile) */
function onScreen(target: string): boolean {
  return Array.from(document.querySelectorAll(`[data-tour="${CSS.escape(target)}"]`)).some((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.right > 0 && r.left < window.innerWidth;
  });
}

/** Projecteur à afficher sur l'écran en cours pour l'étape en cours */
function spotlightFor(pathname: string, state: OnboardingState) {
  const current = state.current;
  if (!current) return null;
  const required = state.steps.filter((s) => !s.optional);
  const label = `Étape ${required.findIndex((s) => s.id === current.id) + 1} sur ${state.total}`;
  if (pathname === '/dashboard') {
    const menu = stepMenu(current);
    return menu.label && onScreen(`nav:${menu.href}`)
      ? { target: `nav:${menu.href}`, step: label, title: `Ouvrez « ${menu.label} »`, text: `${current.title} : ${current.description}` }
      : { target: 'guide:start', step: label, title: current.title, text: `${current.description} Touchez ce bouton pour commencer.` };
  }
  const here = stepForPath(pathname);
  if (!here || here.optional) return null;
  if (here.id === current.id) {
    // Page de formulaire : le formulaire ; page de liste ou fenêtre : le bouton « Ajouter »
    return current.opensForm || pathname !== current.path
      ? { target: `add:${current.id}`, step: label, title: 'Cliquez sur « Ajouter »', text: current.why }
      : { target: `form:${current.id}`, step: label, title: 'Remplissez ce formulaire', text: current.why };
  }
  if (state.steps.find((s) => s.id === here.id)?.done) {
    return { target: 'guide:next', step: label, title: `Étape suivante : ${current.title.toLowerCase()}`, text: 'Cliquez ici pour continuer.' };
  }
  return null;
}

/**
 * Guide interactif de l'administrateur d'un nouvel espace : bienvenue à la première arrivée,
 * puis un projecteur qui montre où cliquer à chaque étape (menu, bouton « Ajouter »,
 * formulaire, étape suivante). Une fois fermé, un projecteur ne revient pas pendant la session.
 */
export function OnboardingLayer() {
  const user = useAuthStore((s) => s.user);
  const state = useOnboarding();
  const pathname = usePathname();
  const [welcomeDone, setWelcomeDone] = useState(false);
  const [closed, setClosed] = useState<string[]>([]);
  const welcomeOpen = !!user && !!state?.active && state.doneCount < state.total && !welcomeDone && !read('welcome', user.id);
  const spotKey = state?.current ? `${pathname}:${state.current.id}:${state.doneCount}` : '';

  useEffect(() => {
    window.__optispaceWelcomeOpen = welcomeOpen;
    return () => {
      window.__optispaceWelcomeOpen = false;
    };
  }, [welcomeOpen]);

  const closeSpot = useCallback(() => {
    sessionStorage.setItem(`optispace:onboarding-spot:${spotKey}`, '1');
    setClosed((c) => [...c, spotKey]);
  }, [spotKey]);

  if (!user || !state?.active) return null;
  if (welcomeOpen) {
    return (
      <WelcomeModal
        name={user.nom}
        state={state}
        onDismiss={() => {
          write('welcome', user.id, String(Date.now()));
          setWelcomeDone(true);
        }}
      />
    );
  }
  if (read('hidden', user.id) === '1' || !spotKey || closed.includes(spotKey)) return null;
  if (sessionStorage.getItem(`optispace:onboarding-spot:${spotKey}`)) return null;
  const spot = spotlightFor(pathname, state);
  if (!spot) return null;
  return <Spotlight key={spotKey} {...spot} onClose={closeSpot} />;
}

// ── Carte du tableau de bord ───────────────────────────────────────────────

function useProgressMemory(userId: string | undefined, state: OnboardingState | null) {
  // Dernière progression connue : pour féliciter quand la dernière étape vient d'être faite
  const [previous] = useState(() => (userId ? Number(read('progress', userId) ?? -1) : -1));
  useEffect(() => {
    if (userId && state && (state.active || state.allDone)) write('progress', userId, String(state.doneCount));
  }, [userId, state]);
  return previous;
}

/** Guide de démarrage sur le tableau de bord : progression, étape en cours, étapes suivantes. */
export function OnboardingCard() {
  const user = useAuthStore((s) => s.user);
  const state = useOnboarding();
  const previous = useProgressMemory(user?.id, state);
  const [hidden, setHidden] = useState(() => (user ? read('hidden', user.id) === '1' : false));
  const [congratsClosed, setCongratsClosed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  if (!user || !state) return null;

  // Mise en place terminée pendant le guide : félicitations, une fois
  if (state.allDone) {
    if (congratsClosed || previous < 0 || previous >= state.total) return null;
    const close = () => {
      write('progress', user.id, String(state.total));
      setCongratsClosed(true);
    };
    const team = state.steps.find((s) => s.id === 'team');
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <PartyPopper className="w-10 h-10 text-emerald-600 shrink-0" />
        <div className="flex-1">
          <p className="font-bold text-emerald-900 dark:text-emerald-200">Bravo, votre espace est prêt !</p>
          <p className="text-sm text-emerald-800/80 dark:text-emerald-300/80">
            Zone, point de vente, tickets, allocation et première collecte : tout est en place. Vos chiffres s’affichent
            maintenant sur ce tableau de bord.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {team && !team.done && (
            <Link href={`${team.path}?guide=ouvrir`} className={buttonClassName({ variant: 'outline', size: 'sm' })}>
              Ajouter un collecteur
            </Link>
          )}
          <button type="button" onClick={close} className={buttonClassName({ size: 'sm' })}>
            Terminer
          </button>
        </div>
      </div>
    );
  }

  if (!state.active) return null;
  const pct = Math.round((state.doneCount / state.total) * 100);

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => {
          write('hidden', user.id, '0');
          setHidden(false);
        }}
        className="w-full sm:w-auto inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 dark:bg-brand-950/30 dark:border-brand-900 px-4 h-10 text-sm font-semibold text-brand-700 dark:text-brand-300"
      >
        <Compass className="w-4 h-4" /> Guide de démarrage · {state.doneCount}/{state.total} · Afficher
      </button>
    );
  }

  const required = state.steps.filter((s) => !s.optional);
  const current = state.current!;
  return (
    <section className="rounded-2xl border border-brand-200 dark:border-brand-900 bg-white dark:bg-slate-900 shadow-xs overflow-hidden" aria-labelledby="onboarding-title">
      <div className="px-5 pt-5 pb-4 bg-gradient-to-r from-brand-50 to-white dark:from-brand-950/40 dark:to-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5" /> Guide de démarrage
            </p>
            <h2 id="onboarding-title" className="text-lg font-bold text-slate-900 dark:text-white">
              Mettez votre espace en place en {state.total} étapes
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              write('hidden', user.id, '1');
              setHidden(true);
            }}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 whitespace-nowrap"
          >
            Masquer le guide
          </button>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
            {state.doneCount} / {state.total}
          </span>
        </div>
      </div>

      {/* Étape en cours, mise en avant */}
      <div className="px-5 py-4 border-t border-brand-100 dark:border-brand-900/60 flex flex-col sm:flex-row sm:items-center gap-3">
        <StepNumber step={current} index={required.indexOf(current)} current />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-brand-700 dark:text-brand-300">
            Étape {required.indexOf(current) + 1} sur {state.total} · à faire maintenant
          </p>
          <p className="font-bold text-slate-900 dark:text-white">{current.title}</p>
          <p className="text-sm text-slate-500">{current.description}</p>
        </div>
        <Link href={stepHref(current)} data-tour="guide:start" className={buttonClassName({ className: 'shrink-0 font-semibold' })}>
          {current.action} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Toutes les étapes */}
      <div className="border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="w-full px-5 py-3 flex items-center justify-between text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          aria-expanded={showAll}
        >
          Voir toutes les étapes
          {showAll ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showAll && (
          <ol className="px-5 pb-4 space-y-3">
            {state.steps.map((s) => {
              const index = required.indexOf(s);
              const isCurrent = current.id === s.id;
              const locked = !s.done && !isCurrent && !s.optional;
              return (
                <li key={s.id} className="flex items-center gap-3">
                  <StepNumber step={s} index={index} current={isCurrent} />
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-semibold', s.done ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-white')}>
                      {s.title}
                      {s.optional && <span className="ml-1.5 text-xs font-normal text-slate-400">(facultatif)</span>}
                    </p>
                    {!s.done && <p className="text-xs text-slate-500">{s.description}</p>}
                  </div>
                  {s.done ? (
                    <span className="text-xs font-semibold text-emerald-600">Fait</span>
                  ) : locked ? (
                    <Lock className="w-4 h-4 text-slate-300" aria-label="Après l'étape précédente" />
                  ) : (
                    <Link href={stepHref(s)} className="text-xs font-semibold text-brand-600 hover:underline whitespace-nowrap">
                      {s.action}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

// ── Bandeau d'étape sur l'écran concerné ───────────────────────────────────

/** Sur l'écran d'une étape : ce qu'il faut faire ici, puis l'étape suivante une fois faite. */
export function OnboardingBanner() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const state = useOnboarding();
  const def = stepForPath(pathname);
  if (!def || !user || !state || !state.active || read('hidden', user.id) === '1') return null;

  const required = state.steps.filter((s) => !s.optional);
  const step = state.steps.find((s) => s.id === def.id)!;
  const current = state.current!;
  const number = required.findIndex((s) => s.id === step.id) + 1;

  // Étape facultative (collecteur) : seulement une fois la mise en place terminée
  if (step.optional) return null;

  let content: React.ReactNode;
  if (step.done) {
    content = (
      <>
        <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-emerald-900 dark:text-emerald-200">Étape {number} terminée : {step.title.toLowerCase()}</p>
          <p className="text-sm text-emerald-800/80 dark:text-emerald-300/80">Prochaine étape : {current.title.toLowerCase()}.</p>
        </div>
        <Link href={stepHref(current)} data-tour="guide:next" className={buttonClassName({ size: 'sm', className: 'shrink-0' })}>
          {current.action} <ArrowRight className="w-4 h-4" />
        </Link>
      </>
    );
  } else if (step.id !== current.id) {
    content = (
      <>
        <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-amber-900 dark:text-amber-200">Avant cette étape : {current.title.toLowerCase()}</p>
          <p className="text-sm text-amber-800/80 dark:text-amber-300/80">{current.description}</p>
        </div>
        <Link href={stepHref(current)} className={buttonClassName({ size: 'sm', variant: 'outline', className: 'shrink-0' })}>
          {current.action}
        </Link>
      </>
    );
  } else {
    content = (
      <>
        <span className="w-8 h-8 rounded-full bg-brand-600 text-white text-sm font-bold flex items-center justify-center shrink-0">{number}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-brand-700 dark:text-brand-300">
            Guide de démarrage · étape {number} sur {state.total}
          </p>
          <p className="font-semibold text-slate-900 dark:text-white">{step.title}</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{step.why}</p>
          {!step.opensForm && pathname === step.path && (
            <p className="text-sm font-semibold text-brand-700 dark:text-brand-300 mt-1">Remplissez le formulaire ci-dessous.</p>
          )}
        </div>
        {!step.opensForm && pathname !== step.path && (
          <Link href={step.path} className={buttonClassName({ size: 'sm', className: 'shrink-0' })}>
            {step.action}
          </Link>
        )}
        {step.opensForm && (
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(GUIDE_OPEN_EVENT))}
            className={buttonClassName({ size: 'sm', className: 'shrink-0' })}
          >
            {step.action}
          </button>
        )}
      </>
    );
  }

  return (
    <div
      role="status"
      className={cn(
        'mb-4 rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3',
        step.done
          ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900'
          : step.id !== current.id
            ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900'
            : 'bg-brand-50 border-brand-200 dark:bg-brand-950/30 dark:border-brand-900'
      )}
    >
      {content}
    </div>
  );
}
