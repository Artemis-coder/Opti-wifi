'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils/cn';

interface BottomSheetMenuProps {
  open: boolean;
  onClose: () => void;
  /** Hauteurs en fraction de la hauteur du viewport, de la plus basse a la plus haute. */
  detents?: number[];
  initialDetent?: number;
  title: string;
  children: React.ReactNode;
  className?: string;
}

function useViewportHeight() {
  const [height, setHeight] = useState(() =>
    typeof window === 'undefined' ? 800 : window.innerHeight
  );
  useEffect(() => {
    const read = () => setHeight(window.visualViewport?.height ?? window.innerHeight);
    read();
    window.addEventListener('resize', read);
    window.visualViewport?.addEventListener('resize', read);
    return () => {
      window.removeEventListener('resize', read);
      window.visualViewport?.removeEventListener('resize', read);
    };
  }, []);
  return height;
}

function Sheet({
  detents,
  initialDetent,
  onClose,
  title,
  children,
  className,
}: Omit<BottomSheetMenuProps, 'open'>) {
  const viewportH = useViewportHeight();
  const heights = detents!.map((f) => Math.round(viewportH * f));
  const [index, setIndex] = useState(initialDetent ?? 0);
  const [dragY, setDragY] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const restY = useRef(heights[initialDetent ?? 0]);
  const startY = useRef(0);
  const lastY = useRef(0);
  const lastT = useRef(0);
  const velocity = useRef(0);
  const onContent = useRef(false);
  const armedRef = useRef(false);
  const draggingRef = useRef(false);

  const dragging = dragY !== null;
  const highest = heights[heights.length - 1];
  const resting = heights[0];

  // La position de repos est memorisee: le geste part toujours d'ou se
  // trouve la feuille, y compris apres un changement de taille du viewport.
  useLayoutEffect(() => {
    if (!dragging) restY.current = heights[index];
  }, [dragging, index, heights]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // La feuille est ancree en bas: descendre le doigt la raccourcit, c'est
  // donc la soustraction, et non l'addition, qui fait suivre le geste.
  const currentHeight = () => (dragging ? restY.current - dragY : heights[index]);
  const height = Math.min(Math.max(currentHeight(), resting * 0.4), highest + 72);

  const onPointerDown = (e: React.PointerEvent) => {
    // `armed` n'est pose que par un appui reel: deplacement de souris et
    // deplacement de finger doivent tous deux etre ignores tant que le
    // geste n'a pas commence.
    armedRef.current = true;
    draggingRef.current = false;
    // Une liste deja defilee n'est saisie que vers le bas: vers le haut, le
    // doigt doit continuer a faire defiler le contenu.
    onContent.current = scrollRef.current?.contains(e.target as Node) ?? false;
    startY.current = e.clientY;
    lastY.current = e.clientY;
    lastT.current = e.timeStamp;
    velocity.current = 0;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!armedRef.current) return;
    const dy = e.clientY - startY.current;
    const scrolled = (scrollRef.current?.scrollTop ?? 0) > 2;

    if (!draggingRef.current) {
      // Le seuil distingue un glissement d'un simple appui: sans lui, le
      // moindre tremblement du doigt ferait sauter la feuille.
      if (onContent.current && scrolled && dy < 0) return;
      if (Math.abs(dy) < 6) return;
      draggingRef.current = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }

    if (dy < 0 && restY.current >= highest - 1) {
      // Palier haut atteint: la feuille depasse de 18px au plus, avec une
      // resistance qui croitt avec l'effort. La resistance porte sur la
      // distance totale, pas sur chaque mouvement: sinon legerement plus, on
      // sent que le geste a ete absorbe.
      restY.current = highest;
      setDragY(-Math.min(18, (startY.current - e.clientY) * 0.18));
      return;
    }

    const dt = e.timeStamp - lastT.current;
    if (dt > 0) velocity.current = (e.clientY - lastY.current) / dt;
    lastY.current = e.clientY;
    lastT.current = e.timeStamp;

    setDragY(dy);
  };

  const finish = useCallback(() => {
    armedRef.current = false;
    draggingRef.current = false;
    const dy = dragY;
    setDragY(null);
    if (dy === null) return;

    const target = restY.current - dy;
    const v = velocity.current;

    if (v > 0.45 || target < resting * 0.78) {
      onClose();
      return;
    }
    if (v < -0.45) {
      setIndex(heights.length - 1);
      return;
    }
    let best = 0;
    for (let i = 1; i < heights.length; i++) {
      if (Math.abs(heights[i] - target) < Math.abs(heights[best] - target)) best = i;
    }
    setIndex(best);
  }, [dragY, heights, onClose, resting]);

  // Le fond s'efface des que l'on descend sous le palier de repos.
  const backdrop = dragging
    ? Math.min(1, Math.max(0, (height - resting * 0.55) / (resting * 0.45)))
    : 1;

  return (
    <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
      <div
        aria-hidden
        onClick={onClose}
        style={{ opacity: backdrop }}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ height: `${height}px` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        className={cn(
          'relative z-10 w-full shrink-0 flex flex-col overflow-hidden bg-slate-100 dark:bg-slate-950',
          'rounded-t-[28px] md-elevation-4 safe-bottom touch-pan-y select-none',
          dragging ? 'shadow-2xl' : 'md-anim-sheet',
          className
        )}
      >
        {/* Poignee et entete: la zone de saisie du geste */}
        <div className="shrink-0 cursor-grab active:cursor-grabbing">
          <div aria-hidden className="flex justify-center pt-2.5 pb-1">
            <div className="h-1.5 w-11 rounded-full bg-slate-300 dark:bg-slate-600" />
          </div>
          <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-1.5">
            <h2 className="min-w-0 flex-1 truncate text-[17px] font-bold text-slate-900 dark:text-white">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="md-ripple tap-target shrink-0 rounded-full px-3.5 h-9 text-sm font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10"
            >
              Fermer
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="md-scroll flex-1 overflow-y-auto overscroll-contain px-3 pb-8">
          {children}
        </div>

        {/* Rappel du geste, uniquement au palier de repos */}
        {index === 0 && !dragging && (
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-slate-400"
          >
            Glisser vers le haut pour agrandir · vers le bas pour fermer
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Feuille qui monte du bas, a la maniere des feuilles iOS.
 *
 * Trois choses la distinguent d'un simple panneau:
 * - des paliers (detents): la feuille se stabilise sur une hauteur de repos
 *   ou sur une hauteur deployee, et le doigt suit exactement le mouvement
 *   entre les deux;
 * - un trait de glissement reellement saisissable, qui ferme la feuille d'un
 *   geste court vers le bas, comme le geste maison d'iOS;
 * - un fond qui s'eclaircit proportionnellement a la fermeture, ce qui donne
 *   le retour visuel du geste au lieu d'une apparition seche.
 *
 * Un glissement vers le haut au-dela du palier le plus haut est elastique
 * (il resistance) plutot que bloque.
 *
 * L'etat vit dans un sous-composant monte uniquement quand la feuille est
 * ouverte: a la fermeture, tout est reinitialise sans effet de synchronisation.
 */
export function BottomSheetMenu({ open, onClose, detents = [0.62, 0.92], initialDetent = 0, ...rest }: BottomSheetMenuProps) {
  if (!open) return null;
  return <Sheet detents={detents} initialDetent={initialDetent} onClose={onClose} {...rest} />;
}
