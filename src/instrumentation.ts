import type { Instrumentation } from 'next';

/**
 * Erreurs serveur non interceptées (pages, routes API, actions) : journalisées pour la page
 * « État du système » du back-office.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { recordSystemError } = await import('@/lib/system-errors');
  const message = err instanceof Error ? err.message : String(err);
  await recordSystemError(context.routeType === 'route' ? 'api' : 'server', message, {
    route: `${request.method} ${request.path}`,
    status: 500,
  });
};
