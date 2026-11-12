'use client';

import React, { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MousePointerClick, X } from 'lucide-react';
import { GUIDE_OPEN_EVENT } from '@/lib/onboarding';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 6;
const TIP_WIDTH = 290;

/** Premier élément visible portant data-tour="target" */
function findTarget(target: string): HTMLElement | null {
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${CSS.escape(target)}"]`));
  return all.find((el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden') ?? null;
}

/**
 * Projecteur du guide interactif : assombrit l'écran autour d'un élément (data-tour), l'entoure
 * et affiche une bulle « cliquez ici ». L'élément reste cliquable ; le projecteur se ferme au
 * clic sur l'élément ou sur « Compris ».
 */
export function Spotlight({
  target,
  step,
  title,
  text,
  onClose,
  footer,
  closeOnTargetClick = true,
}: {
  target: string;
  /** Ex. « Étape 2 sur 5 » */
  step?: string;
  title: string;
  text: string;
  onClose: () => void;
  /** Boutons de la bulle (visite guidée : Précédent / Suivant) ; par défaut « Compris ». */
  footer?: React.ReactNode;
  /** Fermer quand on clique sur l'élément éclairé (désactivé pendant une visite guidée). */
  closeOnTargetClick?: boolean;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  // Affiché une fois l'élément immobile (fin du défilement automatique vers lui)
  const [ready, setReady] = useState(false);

  // Attend que l'élément apparaisse (données chargées), l'amène à l'écran puis suit sa position
  useEffect(() => {
    let el: HTMLElement | null = null;
    let frame = 0;
    let tries = 0;
    let still = 0;
    let last = '';
    const onClick = () => {
      if (closeOnTargetClick) onClose();
    };

    const follow = () => {
      if (!el || !el.isConnected) {
        el = findTarget(target);
        if (el) {
          // Élément plus grand que l'écran (formulaire) : amené par son début
          const tall = el.getBoundingClientRect().height > window.innerHeight * 0.6;
          // Sous l'en-tête fixe, pas derrière
          const header = document.querySelector('header')?.getBoundingClientRect().height ?? 0;
          el.style.scrollMarginTop = `${Math.round(header + 12)}px`;
          el.scrollIntoView({ block: tall ? 'start' : 'center', behavior: 'smooth' });
          el.addEventListener('click', onClick, { capture: true });
        } else if (++tries > 600) {
          return onClose(); // élément absent (~10 s) : on n'insiste pas
        }
      }
      if (el) {
        const r = el.getBoundingClientRect();
        const sig = `${Math.round(r.top)}:${Math.round(r.left)}:${Math.round(r.width)}:${Math.round(r.height)}`;
        still = sig === last ? still + 1 : 0;
        last = sig;
        if (still === 8) setReady(true);
        setRect((prev) =>
          prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height
            ? prev
            : { top: r.top, left: r.left, width: r.width, height: r.height }
        );
      }
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    // Formulaire ouvert depuis le bandeau d'étape : le projecteur a joué son rôle
    window.addEventListener(GUIDE_OPEN_EVENT, onClick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener(GUIDE_OPEN_EVENT, onClick);
      el?.removeEventListener('click', onClick, { capture: true });
    };
  }, [target, onClose, closeOnTargetClick]);

  // Échap ferme le projecteur
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!rect || !ready || typeof document === 'undefined') return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Zone éclairée gardée dans l'écran (bouton pleine largeur sur mobile)
  const left = Math.max(4, rect.left - PAD);
  const right = Math.min(vw - 4, rect.left + rect.width + PAD);
  // Le haut de l'écran est occupé par l'en-tête fixe : le cadre commence en dessous
  const headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
  const top = Math.max(headerBottom + 4, rect.top - PAD);
  const bottom = Math.min(vh - 4, rect.top + rect.height + PAD);
  const hole = { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
  // Bulle sous l'élément, sinon au-dessus ; élément trop grand (formulaire) : en bas de l'écran
  const below = hole.top + hole.height + 200 < vh;
  const above = !below && hole.top > 220;
  const pinned = !below && !above;
  const tipLeft = Math.min(Math.max(12, hole.left + hole.width / 2 - TIP_WIDTH / 2), vw - TIP_WIDTH - 12);
  const arrowLeft = Math.min(Math.max(16, hole.left + hole.width / 2 - tipLeft - 8), TIP_WIDTH - 32);

  return createPortal(
    <div className="fixed inset-0 z-[65] pointer-events-none" aria-live="polite">
      {/* Zone éclairée : l'ombre géante assombrit le reste de l'écran */}
      <div
        className="absolute rounded-xl ring-4 ring-amber-400"
        style={{ ...hole, boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55)' }}
      />
      <div className="absolute rounded-xl ring-[6px] ring-amber-300/70 animate-pulse" style={hole} />

      {/* Bulle d'explication */}
      <div
        role="dialog"
        aria-label={title}
        className="absolute pointer-events-auto rounded-2xl bg-white dark:bg-slate-900 shadow-2xl p-4"
        style={{
          width: TIP_WIDTH,
          left: pinned ? Math.max(12, vw / 2 - TIP_WIDTH / 2) : tipLeft,
          ...(below ? { top: hole.top + hole.height + 14 } : above ? { bottom: vh - hole.top + 14 } : { bottom: 16 }),
        }}
      >
        {!pinned && (
          <span
            className="absolute w-4 h-4 rotate-45 bg-white dark:bg-slate-900"
            style={{ left: arrowLeft, ...(below ? { top: -7 } : { bottom: -7 }) }}
          />
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le guide"
          className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
        {step && <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">{step}</p>}
        <p className="font-bold text-slate-900 dark:text-white pr-6 flex items-center gap-1.5">
          <MousePointerClick className="w-4 h-4 text-amber-500 shrink-0" /> {title}
        </p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{text}</p>
        <div className="mt-3 flex justify-end">
          {footer ?? (
            <button type="button" onClick={onClose} className="h-8 px-3 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
              Compris
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
