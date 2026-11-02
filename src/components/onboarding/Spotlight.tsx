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
}: {
  target: string;
  /** Ex. « Étape 2 sur 5 » */
  step?: string;
  title: string;
  text: string;
  onClose: () => void;
}) {
  const [rect, setRect] = useState<Rect | null>(null);

  // Attend que l'élément apparaisse (données chargées), l'amène à l'écran puis suit sa position
  useEffect(() => {
    let el: HTMLElement | null = null;
    let frame = 0;
    let tries = 0;
    const onClick = () => onClose();

    const follow = () => {
      if (!el || !el.isConnected) {
        el = findTarget(target);
        if (el) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          el.addEventListener('click', onClick, { capture: true });
        } else if (++tries > 600) {
          return onClose(); // élément absent (~10 s) : on n'insiste pas
        }
      }
      if (el) {
        const r = el.getBoundingClientRect();
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
  }, [target, onClose]);

  // Échap ferme le projecteur
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!rect || typeof document === 'undefined') return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const hole = { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 };
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
        className="absolute rounded-xl ring-4 ring-amber-400 transition-all duration-200"
        style={{ ...hole, boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55)' }}
      />
      <div className="absolute rounded-xl ring-4 ring-amber-300 animate-ping opacity-60" style={hole} />

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
          <button type="button" onClick={onClose} className="h-8 px-3 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
            Compris
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
