'use client';

import { useEffect } from 'react';

/**
 * Ajuste tous les tableaux de liste à la largeur de l'écran (à partir de 768 px), sans
 * défilement horizontal et une ligne par cellule :
 * - si le tableau tient, rien ne change ;
 * - sinon les colonnes courtes (téléphone, statut, date, montant, actions) gardent leur
 *   largeur, et les colonnes de texte long se partagent le reste, coupées par « … »
 *   (texte complet au survol).
 * Concerne les tableaux de `ResponsiveTable` (`.responsive-table`) et des blocs
 * `[data-fit-table]`. Un tableau avec un <colgroup> garde ses largeurs définies à la main.
 * Monté une seule fois (layout racine).
 */

const CONTAINERS = '.responsive-table, [data-fit-table]';
/** Au-delà de cette largeur naturelle, une colonne est considérée comme « texte long ». */
const SHORT_COLUMN = 180;
/** Largeur minimale d'une colonne de texte long. */
const MIN_FLEX = 90;

function fitTable(table: HTMLTableElement, avail: number) {
  if (table.querySelector('colgroup') || table.dataset.fit === 'off') return;
  const headRow = table.tHead?.rows[0] ?? table.rows[0];
  if (!headRow) return;
  const cells = Array.from(headRow.cells);
  if (!cells.length || cells.some((c) => c.colSpan > 1)) return;

  table.classList.add('fit-table');
  // Largeurs naturelles (sur une ligne)
  table.style.tableLayout = 'auto';
  table.style.width = 'max-content';
  cells.forEach((c) => (c.style.width = ''));
  const natural = cells.map((c) => Math.ceil(c.getBoundingClientRect().width));
  const total = natural.reduce((a, b) => a + b, 0);

  if (total <= avail) {
    table.style.width = '100%';
    return;
  }

  const flex = natural.map((w) => w > SHORT_COLUMN);
  const fixedSum = natural.reduce((a, w, i) => (flex[i] ? a : a + w), 0);
  const flexNatural = natural.reduce((a, w, i) => (flex[i] ? a + w : a), 0);
  const flexCount = flex.filter(Boolean).length;
  const remaining = avail - fixedSum;

  let widths: number[];
  if (flexCount === 0 || remaining < flexCount * MIN_FLEX) {
    // Écran trop étroit même pour les colonnes courtes : toutes réduites en proportion
    widths = natural.map((w) => Math.floor((w * avail) / total));
  } else {
    widths = natural.map((w, i) => (flex[i] ? Math.max(MIN_FLEX, Math.floor((remaining * w) / flexNatural)) : w));
    // Les minimums peuvent dépasser de quelques pixels : on ramène le total à la largeur dispo
    const sum = widths.reduce((a, b) => a + b, 0);
    if (sum > avail) widths = widths.map((w) => Math.floor((w * avail) / sum));
  }
  cells.forEach((c, i) => (c.style.width = `${widths[i]}px`));
  table.style.width = '100%';
  table.style.tableLayout = 'fixed';
}

function fitAll() {
  const desktop = window.matchMedia('(min-width: 768px)').matches;
  document.querySelectorAll<HTMLElement>(CONTAINERS).forEach((root) => {
    // Ignorer les blocs masqués (ex. tableau réservé à l'ordinateur sur mobile)
    if (!desktop || root.getClientRects().length === 0) return;
    const avail = root.clientWidth;
    if (avail <= 0) return;
    root.querySelectorAll('table').forEach((t) => fitTable(t, avail));
  });
}

/** Texte complet au survol d'une cellule coupée. */
function showFullText(e: MouseEvent) {
  const target = e.target as HTMLElement | null;
  const el = target?.closest<HTMLElement>('.fit-table td, .fit-table th, .fit-table td *');
  if (!el || el.title) return;
  if (el.scrollWidth > el.clientWidth + 1) {
    const text = el.textContent?.trim();
    if (text) el.title = text;
  }
}

export function TableFitter() {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fitAll);
    };
    schedule();
    // Contenu des pages (listes chargées, filtres) : pas les attributs, que l'ajusteur modifie lui-même
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('mouseover', showFullText);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      document.removeEventListener('mouseover', showFullText);
    };
  }, []);
  return null;
}
