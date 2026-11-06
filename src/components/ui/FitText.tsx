'use client';

import React, { useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/utils/cn';

const MIN_FONT_PX = 12;

/**
 * Texte sur une ligne qui tient toujours dans son cadre : il garde sa taille normale quand la
 * place suffit, sinon sa police diminue juste assez (jusqu'à 12 px) pour ne jamais déborder.
 * Recalculé quand la carte change de largeur ou quand la valeur change.
 */
export function FitText({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!el || !box) return;
    const fit = () => {
      el.style.fontSize = ''; // taille définie par les classes
      const available = box.clientWidth;
      const needed = el.scrollWidth;
      if (available > 0 && needed > available) {
        const base = parseFloat(getComputedStyle(el).fontSize);
        el.style.fontSize = `${Math.max(MIN_FONT_PX, Math.floor(base * (available / needed) * 0.98))}px`;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, [children]);

  return (
    <span ref={ref} className={cn('inline-block max-w-full whitespace-nowrap align-bottom', className)}>
      {children}
    </span>
  );
}
