'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

/**
 * Protection anti-copie de l'espace client (données confidentielles).
 *
 * Un site web ne peut pas empêcher une capture d'écran (elle est faite par le système, hors du
 * navigateur) : on rend la copie dissuasive et traçable.
 * - Filigrane nominatif (espace, e-mail, date) sur tout l'écran : une capture qui circule
 *   montre d'où elle vient.
 * - Écran masqué quand la fenêtre n'est plus au premier plan (outils de capture, bascule
 *   d'application) et sur la touche Impr. écran.
 * - Impression : page blanche « Contenu confidentiel » (styles @media print dans globals.css).
 * - Clic droit et copie limités hors des champs de saisie.
 */
export function ConfidentialityGuard({ organizationName, email }: { organizationName: string | null; email: string | null }) {
  const [masked, setMasked] = useState(false);

  // Libellé du filigrane, figé pour la journée
  const label = useMemo(() => {
    const day = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
    return [organizationName, email, day, 'Confidentiel'].filter(Boolean).join(' · ');
  }, [organizationName, email]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const mask = () => setMasked(true);
    const unmask = () => setMasked(false);
    const flash = () => {
      setMasked(true);
      clearTimeout(timer);
      timer = setTimeout(() => setMasked(!document.hasFocus()), 1500);
    };

    const onVisibility = () => (document.visibilityState === 'hidden' ? mask() : unmask());
    const onKey = (e: KeyboardEvent) => {
      // Impr. écran (Windows) : le presse-papiers est vidé et l'écran masqué un instant
      if (e.key === 'PrintScreen') {
        flash();
        void navigator.clipboard?.writeText('').catch(() => {});
      }
      // Raccourcis d'impression et d'enregistrement de la page
      if ((e.ctrlKey || e.metaKey) && ['p', 's'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        flash();
      }
    };
    const isEditable = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || !!t.closest('input, textarea, select, [contenteditable="true"]'));
    const onContextMenu = (e: MouseEvent) => {
      if (!isEditable(e.target)) e.preventDefault();
    };
    // Copie autorisée seulement depuis un champ de saisie
    const onCopy = (e: ClipboardEvent) => {
      if (!isEditable(e.target)) e.preventDefault();
    };

    window.addEventListener('blur', mask);
    window.addEventListener('focus', unmask);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('keyup', onKey);
    window.addEventListener('keydown', onKey);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('copy', onCopy);
    document.documentElement.classList.add('confidential');
    return () => {
      clearTimeout(timer);
      window.removeEventListener('blur', mask);
      window.removeEventListener('focus', unmask);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('copy', onCopy);
      document.documentElement.classList.remove('confidential');
    };
  }, []);

  // Motif répété en diagonale (SVG en arrière-plan : aucun élément à sélectionner ni à supprimer facilement)
  const background = useMemo(() => {
    const text = label.replace(/[<>&"']/g, '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="300"><text x="20" y="190" transform="rotate(-20 320 150)" font-family="system-ui,sans-serif" font-size="14" font-weight="600" fill="#64748b">${text}</text></svg>`;
    return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
  }, [label]);

  return (
    <>
      <div
        aria-hidden
        data-watermark
        className="pointer-events-none fixed inset-0 z-[60] opacity-[0.13] dark:opacity-[0.12] print:hidden"
        style={{ backgroundImage: background, backgroundRepeat: 'repeat' }}
      />
      {masked && (
        <div
          aria-hidden
          className="fixed inset-0 z-[100] bg-slate-100/95 dark:bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center gap-3 text-center p-6"
        >
          <ShieldCheck className="w-10 h-10 text-brand-600" />
          <p className="font-bold text-slate-900 dark:text-white">Contenu confidentiel</p>
          <p className="text-sm text-slate-500 max-w-xs">
            Cliquez dans la fenêtre pour continuer. La reproduction de l’interface et des données est interdite.
          </p>
        </div>
      )}
    </>
  );
}
