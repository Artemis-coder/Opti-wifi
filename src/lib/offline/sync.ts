'use client';

import { toast } from 'sonner';
import { cachedSessionUser, isNetworkError, OFFLINE_EVENTS, queueAll, queueRemove } from './store';

let running = false;

/**
 * Envoie, dans l'ordre, les actions enregistrées hors ligne (collectes) de l'utilisateur
 * connecté. S'arrête à la première coupure réseau ; une action refusée par le serveur est
 * retirée (avec un message) pour ne pas bloquer les suivantes.
 */
export async function processOfflineQueue(): Promise<{ success: number; failed: number }> {
  if (running) return { success: 0, failed: 0 };
  running = true;
  let success = 0;
  let failed = 0;
  let collections = 0;
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
        if (isNetworkError(err)) break; // toujours hors ligne : on réessaiera
        throw err;
      }
      const body = await res.json().catch(() => ({}));
      // Déjà enregistrée (envoi précédent interrompu après l'écriture) : rien à refaire
      const duplicate = typeof body.error === 'string' && /duplicate key|déjà/i.test(body.error);
      if (res.ok || duplicate) {
        success++;
        if (item.label === 'collections') collections++;
      } else {
        failed++;
        console.error('Action hors ligne refusée :', body.error, item);
      }
      await queueRemove(item.id);
    }
  } finally {
    running = false;
  }
  if (collections > 0) toast.success(`${collections} collecte(s) enregistrée(s) hors ligne synchronisée(s).`);
  else if (success > 0) toast.success(`${success} action(s) synchronisée(s).`);
  if (failed > 0) toast.error(`${failed} action(s) hors ligne refusée(s) par le serveur.`);
  if (success > 0) window.dispatchEvent(new Event(OFFLINE_EVENTS.synced));
  return { success, failed };
}
