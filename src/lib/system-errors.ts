// ============================================================
// OPTIWIFI - Journal des erreurs serveur et des échecs d'envoi (État du système).
// Module sans dépendance autre que la base : utilisable depuis l'envoi d'e-mails, de push
// ou de messages Telegram sans dépendance circulaire.
// ============================================================
import { query } from '@/lib/neon/db';

/** Retire de quoi identifier une personne ou un secret avant d'enregistrer un message */
function scrub(text: string): string {
  return text
    .replace(/bot\d+:[\w-]+/g, 'bot***')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '***@***')
    .replace(/(postgres(?:ql)?:\/\/)\S+/g, '$1***')
    .replace(/\b(?:Bearer\s+)?[A-Za-z0-9_-]{32,}\b/g, '***')
    .replace(/\+?\d[\d\s]{7,}\d/g, '***')
    .slice(0, 500);
}

/**
 * Enregistre une erreur serveur ou un échec d'envoi. N'échoue jamais (le journal ne doit pas
 * casser l'action en cours).
 */
export async function recordSystemError(
  source: 'api' | 'push' | 'email' | 'telegram' | 'cron' | 'server',
  message: string,
  opts: { route?: string | null; status?: number | null } = {}
): Promise<void> {
  try {
    await query('INSERT INTO system_errors (source, route, message, status) VALUES ($1, $2, $3, $4)', [
      source,
      opts.route ? opts.route.split('?')[0].slice(0, 200) : null,
      scrub(message || 'Erreur inconnue'),
      opts.status ?? null,
    ]);
  } catch (err) {
    console.error('recordSystemError failed:', err);
  }
}

/** Dernière exécution d'une tâche planifiée */
export async function recordCronRun(name: string, ok: boolean, message: string | null, startedAt: number): Promise<void> {
  try {
    await query(
      `INSERT INTO system_cron_runs (name, last_run_at, ok, message, duration_ms) VALUES ($1, NOW(), $2, $3, $4)
       ON CONFLICT (name) DO UPDATE SET last_run_at = NOW(), ok = $2, message = $3, duration_ms = $4`,
      [name, ok, message ? scrub(message).slice(0, 300) : null, Date.now() - startedAt]
    );
  } catch (err) {
    console.error('recordCronRun failed:', err);
  }
}

