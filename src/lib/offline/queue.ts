'use client';

export interface QueuedAction {
  id: string;
  type: 'create' | 'update' | 'delete';
  table: string;
  payload: Record<string, unknown>;
  timestamp: number;
  retries: number;
}

const QUEUE_KEY = 'optiwifi_offline_queue';
const MAX_RETRIES = 3;

export function getOfflineQueue(): QueuedAction[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: QueuedAction[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    console.error('Failed to save offline queue');
  }
}

export function addToQueue(action: Omit<QueuedAction, 'id' | 'timestamp' | 'retries'>): void {
  const queue = getOfflineQueue();
  const newAction: QueuedAction = {
    ...action,
    id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    retries: 0,
  };
  queue.push(newAction);
  saveOfflineQueue(queue);
}

export function removeFromQueue(actionId: string): void {
  const queue = getOfflineQueue();
  const filtered = queue.filter((a) => a.id !== actionId);
  saveOfflineQueue(filtered);
}

export function clearQueue(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(QUEUE_KEY);
}

export function getQueueLength(): number {
  return getOfflineQueue().length;
}