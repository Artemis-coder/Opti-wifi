'use client';

import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Tableau lisible sur mobile : en dessous de 768 px, chaque ligne devient une carte et
 * chaque cellule est précédée du nom de sa colonne (styles `.responsive-table` dans globals.css).
 * Les libellés sont recopiés depuis l'en-tête du tableau, y compris quand les lignes changent.
 */
export function ResponsiveTable({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const label = () => {
      root.querySelectorAll('table').forEach((table) => {
        const headers = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent?.trim() || '');
        table.querySelectorAll('tbody tr').forEach((tr) => {
          let col = 0;
          Array.from(tr.children).forEach((cell) => {
            const td = cell as HTMLTableCellElement;
            const text = headers[col] || '';
            if (td.colSpan > 1) td.setAttribute('data-full', '');
            else if (td.getAttribute('data-label') !== text) td.setAttribute('data-label', text);
            col += td.colSpan || 1;
          });
        });
      });
    };
    label();
    const observer = new MutationObserver(label);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn('responsive-table overflow-x-auto', className)}>
      {children}
    </div>
  );
}
