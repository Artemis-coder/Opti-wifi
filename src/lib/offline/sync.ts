'use client';

import { toast } from 'sonner';
import { cachedSessionUser, isNetworkError, OFFLINE_EVENTS, queueAll, queueRemove } from './store';
import { refreshReplica } from './replica';

let running = false;

// Libellés singulier / pluriel ; null : non compté (lignes d'une collecte)
const LABELS: Record<string, [string, string] | null> = {
  collections: ['collecte', 'collectes'],
  collection_items: null,
  ticket_allocations: ['allocation', 'allocations'],
  points_of_sale: ['point de vente', 'points de vente'],
  wifi_spaces: ['espace', 'espaces'],
  ticket_types: ['type de ticket', 'types de tickets'],
  profiles: ['profil', 'profils'],
};

/**
 * Envoie, dans l'ordre, les modifications faites hors ligne par l'utilisateur connecté, puis
 * recharge la copie locale depuis la base (ce que d'autres ont ajouté entre-temps).
 * S'arrête à la première coupure réseau, session expirée ou erreur du serveur (on réessaiera) ;
 * une modification refusée est retirée, avec un message, pour ne pas bloquer les suivantes.
 */
export async function processOfflineQueue(): Promise<{ success: number; failed: number }> {
  if (running) return { success: 0, failed: 0 };
  running = true;
  let success = 0;
  let failed = 0;
  let stopped = false;
  const sent: Record<string, number> = {};
  try {
    const userId = cachedSessionUser<{ id?: string }>()?.id ?? null;
    const queue = (await queueAll()).filter((q) => !q.userId || q.userId === userId);
    for (const item of queue) {
      let res: Response;
      try {
        res = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(item.spec),
        });
      } catch (err) {
        if (isNetworkError(err)) {
          stopped = true; // toujours hors ligne : on réessaiera
          break;
        }
        throw err;
      }
      // Session expirée ou serveur indisponible : on garde la file pour plus tard
      if (res.status === 401 || res.status >= 500) {
        stopped = true;
        break;
      }
      const body = await res.json().catch(() => ({}));
      // Déjà enregistrée (envoi précédent interrompu après l'écriture) : rien à refaire
      const duplicate = typeof body.error === 'string' && /duplicate key|déjà/i.test(body.error);
      if (res.ok || duplicate) {
        success++;
        sent[item.label] = (sent[item.label] || 0) + 1;
      } else {
        failed++;
        console.error('Modification hors ligne refusée :', body.error, item);
        toast.error(`Modification hors ligne refusée : ${body.error || 'erreur inconnue'}`);
      }
      await queueRemove(item.id);
    }
  } finally {
    running = false;
  }
  if (success > 0) {
    const parts = Object.entries(sent)
      .filter(([label]) => LABELS[label] !== null)
      .map(([label, n]) => {
        const [one, many] = LABELS[label] ?? ['modification', 'modifications'];
        return `${n} ${n > 1 ? many : one}`;
      });
    toast.success(`Modifications faites hors ligne envoyées${parts.length ? ` : ${parts.join(', ')}` : ''}.`, {
      action: { label: 'Actualiser', onClick: () => window.location.reload() },
    });
  }
  if (failed > 0) toast.error(`${failed} modification(s) hors ligne refusée(s) par le serveur.`);
  // Copie locale rechargée : nouveautés de la base + modifications encore en attente
  if (!stopped) await refreshReplica();
  if (success > 0 || failed > 0) window.dispatchEvent(new Event(OFFLINE_EVENTS.synced));
  return { success, failed };
}
