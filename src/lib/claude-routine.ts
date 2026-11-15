// ============================================================
// OPTIWIFI - Réveil de la routine Claude Code « agent de développement » (déclencheur API).
// Seuls le numéro de la demande et l'action sont envoyés : le contenu reste privé et la routine
// le lit par /api/dev/requests (le texte envoyé est de toute façon traité comme non fiable).
// ============================================================

export type RoutineAction = 'plan' | 'develop' | 'release';

export function isDevRoutineConfigured(): boolean {
  return Boolean(process.env.CLAUDE_DEV_ROUTINE_URL?.trim() && process.env.CLAUDE_DEV_ROUTINE_TOKEN?.trim());
}

export async function fireDevRoutine(requestId: number | null, action: RoutineAction): Promise<{ ok: boolean; sessionUrl?: string; error?: string }> {
  const url = process.env.CLAUDE_DEV_ROUTINE_URL?.trim();
  const token = process.env.CLAUDE_DEV_ROUTINE_TOKEN?.trim();
  if (!url || !token) return { ok: false, error: 'Routine Claude non configurée (CLAUDE_DEV_ROUTINE_URL / CLAUDE_DEV_ROUTINE_TOKEN)' };
  if (!/^https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/[\w-]+\/fire$/.test(url)) {
    return { ok: false, error: 'CLAUDE_DEV_ROUTINE_URL invalide' };
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'anthropic-beta': 'experimental-cc-routine-2026-04-01',
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: `request_id=${requestId ?? 'none'} action=${action}` }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const reason =
        res.status === 401 ? 'jeton de la routine refusé' : res.status === 429 ? 'limite horaire de la routine atteinte, réessayez plus tard' : `erreur ${res.status}`;
      return { ok: false, error: reason };
    }
    const body = (await res.json().catch(() => ({}))) as { claude_code_session_url?: string };
    return { ok: true, sessionUrl: body.claude_code_session_url };
  } catch (err) {
    return { ok: false, error: err instanceof Error && err.name === 'TimeoutError' ? 'délai dépassé' : 'appel impossible' };
  }
}
