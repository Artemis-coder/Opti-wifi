import { notifyError } from '@/lib/telegram';

export async function handleApiError(
  error: unknown,
  context: {
    route: string;
    method: string;
    userId?: string;
    body?: unknown;
  }
) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  await notifyError({
    source: `API ${context.method} ${context.route}`,
    error: errorMessage,
    stack,
    severity: 'high',
    context: {
      userId: context.userId,
      body: context.body ? JSON.stringify(context.body).substring(0, 500) : undefined,
      timestamp: new Date().toISOString(),
    },
  });

  console.error(`API Error [${context.method} ${context.route}]:`, error);
}

export function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
  handler: T,
  route: string
): T {
  return (async (...args: unknown[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      const request = args[0] as Request | undefined;
      await handleApiError(error, {
        route,
        method: request?.method || 'UNKNOWN',
        body: request ? await request.clone().json().catch(() => undefined) : undefined,
      });
      throw error;
    }
  }) as T;
}