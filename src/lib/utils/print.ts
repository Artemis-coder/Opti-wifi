/**
 * Impression autorisée d'un document (facture, rapport) dans l'espace client.
 *
 * La protection anti-copie (components/security/ConfidentialityGuard.tsx) remplace toute impression
 * par une page « Contenu confidentiel ». Les boutons « Télécharger en PDF » passent par ici : la page
 * est marquée `data-print-allowed` le temps de l'impression, ce qui lève ce masque pour ce seul
 * document. Ctrl/Cmd+P reste bloqué par la protection.
 *
 * @param fileName nom proposé pour le PDF (titre de la page pendant l'impression)
 */
export function printDocument(fileName?: string): void {
  const root = document.documentElement;
  const previousTitle = document.title;
  if (fileName) document.title = fileName;
  root.setAttribute('data-print-allowed', '');
  // La boîte d'impression fait perdre le focus : on retire l'écran noir anti-capture
  root.removeAttribute('data-confidential-mask');

  let done = false;
  const restore = () => {
    if (done) return;
    done = true;
    root.removeAttribute('data-print-allowed');
    if (fileName) document.title = previousTitle;
    window.removeEventListener('afterprint', restore);
    window.removeEventListener('focus', onFocus);
  };
  // Filet de sécurité si « afterprint » n'arrive pas : retour au premier plan après l'impression
  const onFocus = () => setTimeout(restore, 1000);
  window.addEventListener('afterprint', restore);
  setTimeout(() => window.addEventListener('focus', onFocus), 500);

  window.print();
}
