import type { Profile } from '@/types/database';

/**
 * Compte encore membre de l'équipe. Un compte supprimé reste en base (désactivé, `deleted_at`
 * renseigné) pour garder le nom sur l'historique des collectes, mais ne doit plus apparaître
 * dans les listes de l'équipe ni dans les choix d'attribution.
 */
export function isActiveProfile(p: Pick<Profile, 'is_active' | 'deleted_at'>): boolean {
  return p.is_active !== false && !p.deleted_at;
}
