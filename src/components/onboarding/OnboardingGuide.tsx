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
        'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0',
        step.done
          ? 'bg-success text-success-foreground'
          : current
            ? 'bg-accent text-accent-foreground ring-4 ring-accent'
            : 'bg-default text-muted'
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
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-backdrop p-3" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-overlay text-overlay-foreground shadow-overlay">
        <div className="bg-accent text-accent-foreground px-6 pt-6 pb-5 rounded-t-2xl relative">
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Fermer"
            className="absolute top-3 right-3 w-9 h-9 rounded-xl flex items-center justify-center text-white/80 hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
          <Sparkles className="w-8 h-8 mb-3 text-warning-soft-foreground" />
          <h2 id="welcome-title" className="text-xl font-semibold">
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
                <p className="font-semibold text-foreground">{s.title}</p>
                <p className="text-sm text-muted">{s.description}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="px-6 -mt-1 text-xs text-muted">
          Ensuite, si vous travaillez en équipe, vous pourrez ajouter des collecteurs qui feront les tournées.
        </p>

        <div className="px-6 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] grid grid-cols-1 gap-2">
          <button type="button" onClick={onDismiss} className={buttonClassName({ className: 'w-full'})}>
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
      <div className="rounded-xl bg-success-soft p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <PartyPopper className="w-10 h-10 text-success-soft-foreground shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-success-soft-foreground">Bravo, votre espace est prêt !</p>
          <p className="text-sm text-success-soft-foreground">
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
        className="w-full sm:w-auto inline-flex items-center gap-2 rounded-xl bg-accent-soft px-4 h-10 text-sm font-semibold text-accent"
      >
        <Compass className="w-4 h-4" /> Guide de démarrage · {state.doneCount}/{state.total} · Afficher
      </button>
    );
  }

  const required = state.steps.filter((s) => !s.optional);
  const current = state.current!;
  return (
    <section className="rounded-2xl border border-accent/30 bg-surface shadow-xs overflow-hidden" aria-labelledby="onboarding-title">
      <div className="px-5 pt-5 pb-4 bg-accent-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-accent flex items-center gap-1">
              <Compass className="w-3.5 h-3.5" /> Guide de démarrage
            </p>
            <h2 id="onboarding-title" className="text-lg font-semibold text-foreground">
              Mettez votre espace en place en {state.total} étapes
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              write('hidden', user.id, '1');
              setHidden(true);
            }}
            className="text-xs font-semibold text-muted hover:text-foreground whitespace-nowrap"
          >
            Masquer le guide
          </button>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-default overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-semibold text-muted tabular-nums">
            {state.doneCount} / {state.total}
          </span>
        </div>
      </div>

      {/* Étape en cours, mise en avant */}
      <div className="px-5 py-4 border-t border-accent/30 flex flex-col sm:flex-row sm:items-center gap-3">
        <StepNumber step={current} index={required.indexOf(current)} current />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-accent">
            Étape {required.indexOf(current) + 1} sur {state.total} · à faire maintenant
          </p>
          <p className="font-semibold text-foreground">{current.title}</p>
          <p className="text-sm text-muted">{current.description}</p>
        </div>
        <Link href={stepHref(current)} data-tour="guide:start" className={buttonClassName({ className: 'shrink-0'})}>
          {current.action} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Toutes les étapes */}
      <div className="border-t border-separator">
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="w-full px-5 py-3 flex items-center justify-between text-sm font-semibold text-muted hover:bg-surface-secondary"
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
                    <p className={cn('text-sm font-semibold', s.done ? 'text-muted line-through' : 'text-foreground')}>
                      {s.title}
                      {s.optional && <span className="ml-1.5 text-xs font-normal text-muted">(facultatif)</span>}
                    </p>
                    {!s.done && <p className="text-xs text-muted">{s.description}</p>}
                  </div>
                  {s.done ? (
                    <span className="text-xs font-semibold text-success-soft-foreground">Fait</span>
                  ) : locked ? (
                    <Lock className="w-4 h-4 text-muted" aria-label="Après l'étape précédente" />
                  ) : (
                    <Link href={stepHref(s)} className="text-xs font-semibold text-accent hover:underline whitespace-nowrap">
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
        <Check className="w-5 h-5 text-success-soft-foreground shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-success-soft-foreground">Étape {number} terminée : {step.title.toLowerCase()}</p>
          <p className="text-sm text-success-soft-foreground">Prochaine étape : {current.title.toLowerCase()}.</p>
        </div>
        <Link href={stepHref(current)} data-tour="guide:next" className={buttonClassName({ size: 'sm', className: 'shrink-0'})}>
          {current.action} <ArrowRight className="w-4 h-4" />
        </Link>
      </>
    );
  } else if (step.id !== current.id) {
    content = (
      <>
        <Lock className="w-5 h-5 text-warning-soft-foreground shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-warning-soft-foreground">Avant cette étape : {current.title.toLowerCase()}</p>
          <p className="text-sm text-warning-soft-foreground">{current.description}</p>
        </div>
        <Link href={stepHref(current)} className={buttonClassName({ size: 'sm', variant: 'outline', className: 'shrink-0'})}>
          {current.action}
        </Link>
      </>
    );
  } else {
    content = (
      <>
        <span className="w-8 h-8 rounded-full bg-accent text-accent-foreground text-sm font-semibold flex items-center justify-center shrink-0">{number}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-accent">
            Guide de démarrage · étape {number} sur {state.total}
          </p>
          <p className="font-semibold text-foreground">{step.title}</p>
          <p className="text-sm text-muted">{step.why}</p>
          {!step.opensForm && pathname === step.path && (
            <p className="text-sm font-semibold text-accent mt-1">Remplissez le formulaire ci-dessous.</p>
          )}
        </div>
        {!step.opensForm && pathname !== step.path && (
          <Link href={step.path} className={buttonClassName({ size: 'sm', className: 'shrink-0'})}>
            {step.action}
          </Link>
        )}
        {step.opensForm && (
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(GUIDE_OPEN_EVENT))}
            className={buttonClassName({ size: 'sm', className: 'shrink-0'})}
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
        'mb-4 rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3',
        step.done
          ? 'bg-success-soft'
          : step.id !== current.id
            ? 'bg-warning-soft'
            : 'bg-accent-soft'
      )}
    >
      {content}
    </div>
  );
}
