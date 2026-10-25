// ============================================================
// OPTIWIFI - Contexte de session et isolation des données par organisation.
// Chaque client ne doit voir et modifier que les données de son organisation ;
// le filtre est imposé côté serveur, jamais délégué au navigateur.
// ============================================================
import { cookies } from 'next/headers';
import { verifyToken, getUserById, AUTH_COOKIE_NAME } from '@/lib/neon/auth';
import { getPlatformUser } from '@/lib/neon/server';

export interface SessionContext {
  userId: string;
  role: string;
  organizationId: string | null;
  isPlatformAdmin: boolean;
}

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
    isPlatformAdmin: !!platformUser?.is_active && platformUser.role === 'super_admin',
  };
}

/** Vrai si la session peut accéder à une ligne appartenant à cette organisation. */
export function canAccessOrganization(ctx: SessionContext, organizationId: string | null | undefined): boolean {
  if (ctx.isPlatformAdmin) return true;
  return !!ctx.organizationId && organizationId === ctx.organizationId;
}
