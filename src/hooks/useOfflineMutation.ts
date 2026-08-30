'use client';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { addToQueue } from '@/lib/offline/queue';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

export function useOfflineMutation() {
  const { isOnline } = useOnlineStatus();
  const supabase = createClient();

  const mutate = async <T,>({
    table,
    type,
    payload,
    onSuccess,
    onError,
  }: {
    table: string;
    type: 'create' | 'update' | 'delete';
    payload: Record<string, unknown>;
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
  }): Promise<T | null> => {
    if (!isOnline) {
      addToQueue({
        type,
        table,
        payload,
      });
      toast.info('Action sauvegardée localement. Elle sera synchronisée quand vous serez en ligne.');
      return null;
    }

    try {
      let result: { data: T | null; error: Error | null } = { data: null, error: null };

      switch (type) {
        case 'create':
          result = await supabase.from(table as never).insert(payload as never).select().single();
          break;
        case 'update':
          result = await supabase.from(table as never).update(payload as never).eq('id', (payload.id as string) || '').select().single();
          break;
        case 'delete':
          const { error } = await supabase.from(table as never).delete().eq('id', (payload.id as string) || '');
          result = { data: null, error };
          break;
      }

      if (result.error) {
        throw result.error;
      }

      onSuccess?.(result.data as T);
      return result.data as T;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      onError?.(err);
      toast.error(err.message);
      return null;
    }
  };

  return { mutate, isOnline };
}