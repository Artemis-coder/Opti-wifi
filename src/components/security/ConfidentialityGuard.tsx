'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

/**
 * Protection anti-copie de l'espace client (données confidentielles).
 *
 * Un site web ne peut pas empêcher une capture d'écran (elle est faite par le système, hors du
 * navigateur) : on la rend inutile autant que possible, avec un écran noir.
 * - Écran noir quand la fenêtre n'est plus au premier plan (outils de capture, bascule
 *   d'application) et sur la touche Impr. écran (presse-papiers vidé).
 * - Impression : page noire « Contenu confidentiel » (styles @media print dans globals.css).
 * - Clic droit et copie limités hors des champs de saisie.
 */
export function ConfidentialityGuard() {
  const [masked, setMasked] = useState(false);

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

  return (
    <>
      {masked && (
        <div
          aria-hidden
          className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center gap-3 text-center p-6"
        >
          <ShieldCheck className="w-10 h-10 text-slate-600" />
          <p className="font-bold text-slate-400">Contenu confidentiel</p>
          <p className="text-sm text-slate-600 max-w-xs">
            Cliquez dans la fenêtre pour continuer. La reproduction de l’interface et des données est interdite.
          </p>
        </div>
      )}
    </>
  );
}
