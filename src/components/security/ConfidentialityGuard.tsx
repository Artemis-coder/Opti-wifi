'use client';

import React, { useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';

/** Touches finales des captures système : elles n'arrivent en général pas jusqu'à la page. */
const CAPTURE_KEYS = new Set(['3', '4', '5', '6', 's', 'S', 'PrintScreen', '#', '$', '%', '^', '§']);
const MODIFIERS = new Set(['Meta', 'OS', 'Shift', 'Alt', 'Control', 'CapsLock']);

/**
 * Protection anti-copie de l'espace client (données confidentielles).
 *
 * Les raccourcis de capture sont interceptés par le système (Mac : Cmd+Maj+3/4/5/6 ; Windows :
 * Win+Maj+S, Impr. écran, Win+Impr. écran, Alt+Impr. écran) : une page web ne peut pas les
 * annuler. Mais elle reçoit les touches de modification une fraction de seconde AVANT la touche
 * finale : l'écran passe au noir dès Cmd/Win + Maj (ou Win + Alt), la capture sort donc noire.
 * - Si la combinaison s'avère être un raccourci ordinaire (ex. Cmd+Maj+Z), l'écran revient aussitôt.
 * - Sinon il reste noir jusqu'au prochain clic dans la page (après la capture, ou la sélection
 *   d'une zone).
 * - Écran noir aussi quand la fenêtre n'est plus au premier plan (outil de capture ouvert,
 *   changement d'application), sur Impr. écran (presse-papiers vidé), Ctrl/Cmd+P ou S.
 * - Impression : page noire « Contenu confidentiel » (styles @media print dans globals.css).
 * - Sélection, copie et clic droit désactivés hors des champs de saisie.
 *
 * Le masquage passe par un attribut sur <html> (CSS, sans attendre un rendu React) pour être
 * affiché avant que le système ne prenne la capture.
 */
export function ConfidentialityGuard() {
  useEffect(() => {
    const root = document.documentElement;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Masqué par une combinaison de capture : seul un clic dans la page rétablit l'écran
    let captureArmed = false;

    const mask = () => root.setAttribute('data-confidential-mask', '');
    const unmask = () => {
      clearTimeout(timer);
      root.removeAttribute('data-confidential-mask');
    };
    const armCapture = () => {
      captureArmed = true;
      mask();
    };
    const release = () => {
      captureArmed = false;
      unmask();
    };
    const flash = () => {
      mask();
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!captureArmed && document.hasFocus()) unmask();
      }, 1500);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.key === 'Meta' || e.key === 'OS';
      const shift = e.shiftKey || e.key === 'Shift';
      const alt = e.altKey || e.key === 'Alt';
      // Début possible d'une capture : Cmd/Win + Maj (Mac Cmd+Maj+3/4/5/6, Windows Win+Maj+S),
      // Win + Alt (barre de jeu Windows)
      if (meta && (shift || alt) && MODIFIERS.has(e.key)) {
        armCapture();
        return;
      }
      if (e.key === 'PrintScreen' || (meta && CAPTURE_KEYS.has(e.key))) {
        armCapture();
        void navigator.clipboard?.writeText('').catch(() => {});
        return;
      }
      // Une autre touche est arrivée : c'était un raccourci ordinaire, pas une capture
      if (captureArmed && !MODIFIERS.has(e.key)) release();
      // Impression et enregistrement de la page
      if ((e.ctrlKey || e.metaKey) && ['p', 's'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        flash();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      // Impr. écran n'envoie souvent que le relâchement (Windows)
      if (e.key === 'PrintScreen') {
        armCapture();
        void navigator.clipboard?.writeText('').catch(() => {});
      }
    };
    const onPointerDown = () => {
      if (root.hasAttribute('data-confidential-mask')) release();
    };
    const onBlur = () => mask();
    const onFocus = () => {
      if (!captureArmed) unmask();
    };
    const onVisibility = () => (document.visibilityState === 'hidden' ? mask() : onFocus());

    const isEditable = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || !!t.closest('input, textarea, select, [contenteditable="true"]'));
    const onContextMenu = (e: MouseEvent) => {
      if (!isEditable(e.target)) e.preventDefault();
    };
    // Copie autorisée seulement depuis un champ de saisie
    const onCopy = (e: ClipboardEvent) => {
      if (!isEditable(e.target)) e.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('copy', onCopy);
    root.classList.add('confidential');
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('copy', onCopy);
      root.classList.remove('confidential');
      root.removeAttribute('data-confidential-mask');
    };
  }, []);

  // Toujours présent dans la page, affiché par CSS (html[data-confidential-mask]) : aucun délai de rendu
  return (
    <div
      aria-hidden
      data-confidential-overlay
      className="fixed inset-0 z-[100] bg-black flex-col items-center justify-center gap-3 text-center p-6"
    >
      <ShieldCheck className="w-10 h-10 text-slate-600" />
      <p className="font-bold text-slate-400">Contenu confidentiel</p>
      <p className="text-sm text-slate-600 max-w-xs">
        Cliquez dans la fenêtre pour continuer. La reproduction de l’interface et des données est interdite.
      </p>
    </div>
  );
}
