import React from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Grille de chiffres clés « bien carrée » : la dernière ligne occupe toujours toute la largeur.
 * Exemple avec 5 tuiles sur 2 colonnes : 2 + 2 + 1, et la dernière tuile prend la ligne entière ;
 * sur 3 colonnes : 3 + 2, et les deux dernières se partagent la ligne à parts égales.
 *
 * Principe : chaque palier d'écran utilise une grille de U unités, U étant divisible par tous les
 * nombres de tuiles possibles sur une ligne (2 colonnes → 2 unités, 3 → 6, 4 → 12, 5 → 60).
 * Une tuile d'une ligne complète vaut U / colonnes ; une tuile de la dernière ligne vaut
 * U / (tuiles restantes).
 */
interface KpiGridProps {
  children: React.ReactNode;
  /** Colonnes par palier d'écran : mobile (base), ≥ 640 px (sm), ≥ 1024 px (lg), ≥ 1280 px (xl). */
  cols?: { base: number; sm?: number; lg?: number; xl?: number };
  className?: string;
}

const lcm = (a: number, b: number): number => {
  const gcd = (x: number, y: number): number => (y === 0 ? x : gcd(y, x % y));
  return (a * b) / gcd(a, b);
};
/** Plus petit nombre d'unités divisible par 1, 2, …, cols. */
const unitsFor = (cols: number) => Array.from({ length: cols }, (_, i) => i + 1).reduce(lcm, 1);

/** Largeur (en unités) de la tuile n° index parmi count, sur cols colonnes. */
function spanFor(index: number, count: number, cols: number): number {
  const units = unitsFor(cols);
  const remainder = count % cols;
  const inLastRow = remainder !== 0 && index >= count - remainder;
  return inLastRow ? units / remainder : units / cols;
}

export function KpiGrid({ children, cols = { base: 2, sm: 3, lg: 4 }, className }: KpiGridProps) {
  const items = React.Children.toArray(children).filter(Boolean);
  const base = cols.base;
  const sm = cols.sm ?? base;
  const lg = cols.lg ?? sm;
  const xl = cols.xl ?? lg;

  return (
    <div
      className={cn(
        'grid gap-3 sm:gap-4',
        'grid-cols-[repeat(var(--kpi-u),minmax(0,1fr))]',
        'sm:grid-cols-[repeat(var(--kpi-u-sm),minmax(0,1fr))]',
        'lg:grid-cols-[repeat(var(--kpi-u-lg),minmax(0,1fr))]',
        'xl:grid-cols-[repeat(var(--kpi-u-xl),minmax(0,1fr))]',
        className,
      )}
      style={
        {
          '--kpi-u': unitsFor(base),
          '--kpi-u-sm': unitsFor(sm),
          '--kpi-u-lg': unitsFor(lg),
          '--kpi-u-xl': unitsFor(xl),
        } as React.CSSProperties
      }
    >
      {items.map((child, i) => (
        <div
          key={(React.isValidElement(child) && child.key) || i}
          className="min-w-0 flex [&>*]:flex-1 [&>*]:min-w-0 [grid-column:span_var(--kpi-s)] sm:[grid-column:span_var(--kpi-s-sm)] lg:[grid-column:span_var(--kpi-s-lg)] xl:[grid-column:span_var(--kpi-s-xl)]"
          style={
            {
              '--kpi-s': spanFor(i, items.length, base),
              '--kpi-s-sm': spanFor(i, items.length, sm),
              '--kpi-s-lg': spanFor(i, items.length, lg),
              '--kpi-s-xl': spanFor(i, items.length, xl),
            } as React.CSSProperties
          }
        >
          {child}
        </div>
      ))}
    </div>
  );
}
