import React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button, buttonClassName } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';

interface AddButtonProps {
  /** Ce que l'on ajoute, pour les lecteurs d'écran (ex. « un point de vente ») */
  what: string;
  /** Lien vers la page de création (sinon : bouton avec onClick) */
  href?: string;
  onClick?: () => void;
  className?: string;
}

/**
 * Bouton « Ajouter » du design system : même libellé, même icône, même style partout
 * (en-têtes de page et états vides). Pleine largeur sur mobile, largeur auto au-delà.
 */
export function AddButton({ what, href, onClick, className }: AddButtonProps) {
  const classes = cn('w-full sm:w-auto font-semibold', className);
  const label = `Ajouter ${what}`;
  if (href) {
    return (
      <Link href={href} aria-label={label} className={buttonClassName({ className: classes })}>
        <Plus className="w-4 h-4 shrink-0" aria-hidden />
        Ajouter
      </Link>
    );
  }
  return (
    <Button type="button" icon={Plus} onClick={onClick} aria-label={label} className={classes}>
      Ajouter
    </Button>
  );
}
