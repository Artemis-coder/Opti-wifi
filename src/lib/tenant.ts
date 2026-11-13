// ============================================================
// OPTIWIFI - Contexte de session et isolation des données par organisation.
// Chaque client ne doit voir et modifier que les données de son organisation ;
// le filtre est imposé côté serveur, jamais délégué au navigateur.
// ============================================================
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { READ_ONLY_MESSAGE } from '@/lib/read-only';

export { READ_ONLY_MESSAGE };
import { verifyToken, getUserById, AUTH_COOKIE_NAME } from '@/lib/neon/auth';
import { getPlatformUser } from '@/lib/neon/server';

export interface SessionContext {
  userId: string;
  role: string;
  organizationId: string | null;
  organizationStatus: string | null;
  /** Licence expirée (l'organisation en a eu une, plus aucune n'est active et en cours). */
  licenceExpired: boolean;
  /** Organisation suspendue, supprimée, refusée ou en attente : plus aucun accès à ses données. */
  organizationBlocked: boolean;
  /**
   * Consultation seule : abonnement expiré (ou organisation bloquée). Les données restent
   * lisibles, mais aucune création, modification ni suppression n'est acceptée.
   */
  readOnly: boolean;
  blockReason: 'organization_status' | 'licence_expired' | null;
  isPlatformAdmin: boolean;
  /** Compte « point de vente » : son point de vente (null si non rattaché). */
  posId: string | null;
}

/** Rôle du compte d'un point de vente : consultation seule de son point de vente. */
export const POS_ACCOUNT_ROLE = 'point_de_vente';

/** Message renvoyé à toute écriture tentée par un compte point de vente. */
export const POS_ACCOUNT_READ_ONLY_MESSAGE = 'Compte point de vente : consultation seule.';

/** Vrai pour le compte d'un point de vente (lecture seule, limité à son point de vente). */
export function isPosAccount(ctx: Pick<SessionContext, 'role' | 'isPlatformAdmin'> | null | undefined): boolean {
  return !!ctx && !ctx.isPlatformAdmin && ctx.role === POS_ACCOUNT_ROLE;
}

/** Statuts d'organisation qui coupent l'accès aux données (le super admin garde l'accès). */
export const BLOCKED_ORGANIZATION_STATUSES = ['suspended', 'archived', 'cancelled', 'pending_approval'];

export async function getSessionContext(token?: string | null): Promise<SessionContext | null> {
  const value = token ?? (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!value) return null;

  const payload = verifyToken(value);
  if (!payload) return null;

  const user = await getUserById(payload.sub);
  if (!user) return null;

  const platformUser = await getPlatformUser(user.id);
  return {
    userId: user.id,
    role: user.role,
    organizationId: user.organization_id || null,
    organizationStatus: user.organization_status || null,
    licenceExpired: user.licence_expired === true,
    organizationBlocked: BLOCKED_ORGANIZATION_STATUSES.includes(user.organization_status || ''),
    readOnly: BLOCKED_ORGANIZATION_STATUSES.includes(user.organization_status || '') || user.licence_expired === true,
    blockReason: BLOCKED_ORGANIZATION_STATUSES.includes(user.organization_status || '')
      ? 'organization_status'
      : user.licence_expired
        ? 'licence_expired'
        : null,
    isPlatformAdmin: !!platformUser?.is_active && platformUser.role === 'super_admin',
    posId: user.role === POS_ACCOUNT_ROLE ? user.pos_id ?? null : null,
  };
}

/** Vrai si la session peut accéder à une ligne appartenant à cette organisation. */
export function canAccessOrganization(ctx: SessionContext, organizationId: string | null | undefined): boolean {
  if (ctx.isPlatformAdmin) return true;
  return !!ctx.organizationId && !ctx.organizationBlocked && organizationId === ctx.organizationId;
}


/**
 * Écriture interdite (abonnement expiré, organisation bloquée, compte point de vente) ;
 * le super admin n'est pas concerné.
 */
export function isWriteBlocked(ctx: SessionContext | null | undefined): boolean {
  return !!ctx && !ctx.isPlatformAdmin && (ctx.readOnly || isPosAccount(ctx));
}

/** Message d'erreur adapté à la raison du blocage en écriture. */
export function writeBlockedMessage(ctx: SessionContext): string {
  if (ctx.organizationBlocked) return 'Accès suspendu pour cette organisation';
  return ctx.readOnly ? READ_ONLY_MESSAGE : POS_ACCOUNT_READ_ONLY_MESSAGE;
}

/**
 * À placer en tête de toute route qui écrit : réponse 403 si l'espace est en consultation
 * seule (abonnement expiré) ou bloqué, sinon null.
 */
export async function rejectIfReadOnly(ctx?: SessionContext | null): Promise<NextResponse | null> {
  const session = ctx === undefined ? await getSessionContext() : ctx;
  if (!session || !isWriteBlocked(session)) return null;
  return NextResponse.json({ error: writeBlockedMessage(session), readOnly: session.readOnly }, { status: 403 });
}
