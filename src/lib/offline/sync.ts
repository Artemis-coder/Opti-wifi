'use client';

import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { QueuedAction, getOfflineQueue, removeFromQueue, clearQueue } from './queue';

export async function processOfflineQueue(): Promise<{ success: number; failed: number }> {
  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { success: 0, failed: 0 };
  }

  const supabase = createClient();
  let successCount = 0;
  let failedCount = 0;

  for (const action of queue) {
    try {
      let error: Error | null = null;

      switch (action.type) {
        case 'create':
          const { error: createError } = await supabase
            .from(action.table as never)
            .insert(action.payload as never);
          error = createError;
          break;
        case 'update':
          const { error: updateError } = await supabase
            .from(action.table as never)
            .update(action.payload as never)
            .eq('id', (action.payload.id as string) || '');
          error = updateError;
          break;
        case 'delete':
          const { error: deleteError } = await supabase
            .from(action.table as never)
            .delete()
            .eq('id', (action.payload.id as string) || '');
          error = deleteError;
          break;
      }

      if (error) {
        throw error;
      }

      removeFromQueue(action.id);
      successCount++;
    } catch {
      failedCount++;
      console.error(`Failed to sync action ${action.id}:`, action);
    }
  }

  if (successCount > 0) {
    toast.success(`${successCount} modification(s) synchronisée(s)`);
  }
  if (failedCount > 0) {
    toast.error(`${failedCount} modification(s) échouée(s) lors de la synchronisation`);
  }

  return { success: successCount, failed: failedCount };
}