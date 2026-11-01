// ============================================================
// OPTIWIFI - Stockage hors ligne (IndexedDB) : dernières données lues en ligne, et
// actions enregistrées hors ligne en attente d'envoi.
// Tout est effacé à la connexion et à la déconnexion (appareil partagé).
// ============================================================

const DB_NAME = 'optispace-offline';
const DB_VERSION = 2;
const CACHE = 'cache';
const QUEUE = 'queue';
/** Copie locale des tables de l'espace (une entrée par table) */
const TABLES = 'tables';

export const OFFLINE_EVENTS = {
  /** File d'attente modifiée (ajout, envoi) */
  queueChanged: 'optispace:offline-queue',
  /** Données servies depuis le cache local */
  servedFromCache: 'optispace:offline-cache',
  /** Synchronisation terminée (actions envoyées) */
  synced: 'optispace:offline-synced',
  /** Copie locale des données mise à jour */
  replicaUpdated: 'optispace:offline-replica',
} as const;

export interface CachedEntry {
  key: string;
  data: unknown;
  at: number;
}

export interface QueuedMutation {
  id: string;
  /** Utilisateur qui a fait l'action : seules ses actions sont envoyées avec sa session */
  userId: string | null;
  /** Requête /api/db à rejouer telle quelle */
  spec: Record<string, unknown>;
  label: string;
  at: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB indisponible'));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(CACHE)) db.createObjectStore(CACHE, { keyPath: 'key' });
        if (!db.objectStoreNames.contains(QUEUE)) db.createObjectStore(QUEUE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(TABLES)) db.createObjectStore(TABLES, { keyPath: 'table' });
      };
      req.onsuccess = () => {
        const db = req.result;
        // Nouvelle version ouverte dans un autre onglet : on libère la base
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  return dbPromise;
}

async function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Cache des lectures ─────────────────────────────────────────────────────

export async function cacheGet(key: string): Promise<CachedEntry | null> {
  try {
    return ((await run(CACHE, 'readonly', (s) => s.get(key))) as CachedEntry | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, data: unknown): Promise<void> {
  try {
    await run(CACHE, 'readwrite', (s) => s.put({ key, data, at: Date.now() } satisfies CachedEntry));
    localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
  } catch {
    // Stockage plein ou indisponible : l'application continue en ligne
  }
}

// ── Copie locale des tables ────────────────────────────────────────────────

export interface TableEntry {
  table: string;
  rows: Record<string, unknown>[];
  at: number;
}

export async function tableGet(table: string): Promise<TableEntry | null> {
  try {
    return ((await run(TABLES, 'readonly', (s) => s.get(table))) as TableEntry | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function tablePut(table: string, rows: Record<string, unknown>[], at = Date.now()): Promise<void> {
  await run(TABLES, 'readwrite', (s) => s.put({ table, rows, at } satisfies TableEntry));
}

// ── File d'attente des actions hors ligne ──────────────────────────────────

export async function queueAdd(item: Omit<QueuedMutation, 'id' | 'at'>): Promise<void> {
  const entry: QueuedMutation = { ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, at: Date.now() };
  await run(QUEUE, 'readwrite', (s) => s.put(entry));
  window.dispatchEvent(new Event(OFFLINE_EVENTS.queueChanged));
}

export async function queueAll(): Promise<QueuedMutation[]> {
  try {
    const all = ((await run(QUEUE, 'readonly', (s) => s.getAll())) as QueuedMutation[]) || [];
    return all.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}

export async function queueRemove(id: string): Promise<void> {
  await run(QUEUE, 'readwrite', (s) => s.delete(id));
  window.dispatchEvent(new Event(OFFLINE_EVENTS.queueChanged));
}

export async function queueCount(): Promise<number> {
  try {
    return (await run(QUEUE, 'readonly', (s) => s.count())) as number;
  } catch {
    return 0;
  }
}

// ── Session et nettoyage ───────────────────────────────────────────────────

const SESSION_KEY = 'optispace:offline-session';
const LAST_SYNC_KEY = 'optispace:offline-last-sync';

/** Utilisateur de la dernière session vérifiée en ligne (pour rester connecté hors ligne) */
export function rememberSessionUser(user: unknown): void {
  try {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignoré
  }
}

export function cachedSessionUser<T>(): T | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Date de la dernière donnée synchronisée (ms) */
export function lastSyncAt(): number | null {
  const v = typeof localStorage !== 'undefined' ? Number(localStorage.getItem(LAST_SYNC_KEY)) : 0;
  return v > 0 ? v : null;
}

/**
 * Efface tout ce qui est conservé hors ligne (cache, session, pages du service worker).
 * keepQueue : garde les actions pas encore envoyées (elles ne partent qu'avec leur utilisateur).
 */
export async function clearOfflineData({ keepQueue = true }: { keepQueue?: boolean } = {}): Promise<void> {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LAST_SYNC_KEY);
    localStorage.removeItem('optiwifi_offline_queue');
    sessionStorage.removeItem('optispace:offline-warmup');
    localStorage.removeItem('optispace:offline-replica-at');
  } catch {
    // ignoré
  }
  try {
    await run(CACHE, 'readwrite', (s) => s.clear());
    await run(TABLES, 'readwrite', (s) => s.clear());
    if (!keepQueue) await run(QUEUE, 'readwrite', (s) => s.clear());
  } catch {
    // ignoré
  }
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('optispace-')).map((k) => caches.delete(k)));
    }
  } catch {
    // ignoré
  }
}

/** Vrai si l'erreur vient du réseau (hors ligne, serveur injoignable) */
export function isNetworkError(err: unknown): boolean {
  return (typeof navigator !== 'undefined' && navigator.onLine === false) || err instanceof TypeError;
}
