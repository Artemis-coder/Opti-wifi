// ============================================================
// OPTIWIFI - Copie locale des données de l'espace, pour travailler sans réseau.
// En ligne : les tables de l'espace sont téléchargées (via /api/db, donc avec les mêmes
// droits que l'utilisateur). Hors ligne : les lectures sont calculées sur cette copie et
// les modifications y sont appliquées, puis envoyées au retour du réseau.
// ============================================================
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { QuerySpec } from '@/lib/neon/query-builder';
import { cachedSessionUser, clearOfflineData, OFFLINE_EVENTS, queueAll, rememberSessionUser, tableGet, tablePut } from './store';

type Row = Record<string, any>;

/** Tables gardées sur l'appareil */
export const REPLICA_TABLES = [
  'wifi_spaces',
  'points_of_sale',
  'ticket_types',
  'ticket_allocations',
  'collections',
  'collection_items',
  'profiles',
  'organizations',
  'subscriptions',
  'subscription_plans',
  'license_requests',
] as const;

/** Tables modifiables hors ligne (mêmes droits qu'en ligne, vérifiés à l'envoi) */
export const OFFLINE_WRITABLE = new Set([
  'wifi_spaces',
  'points_of_sale',
  'ticket_types',
  'ticket_allocations',
  'collections',
  'collection_items',
  'profiles',
]);

// Valeurs par défaut et colonnes calculées de la base (supabase/neon_schema.sql)
const DEFAULTS: Record<string, Row> = {
  wifi_spaces: { statut: 'actif' },
  points_of_sale: { ville: 'Abidjan', statut: 'actif' },
  ticket_types: { actif: true },
  ticket_allocations: { type: 'allocation', statut: 'validee' },
  collections: { statut: 'validee', montant_attendu: 0, montant_collecte: 0, commission: 0 },
  collection_items: { stock_debut: 0 },
};

function computeColumns(table: string, row: Row): void {
  if (table === 'collections') row.difference = Number(row.montant_collecte || 0) - Number(row.montant_attendu || 0);
  if (table === 'collection_items') row.montant_total = Number(row.quantite_vendue || 0) * Number(row.prix_unitaire || 0);
}

const REPLICA_AT_KEY = 'optispace:offline-replica-at';

/** Date de la dernière copie complète (ms) */
export function replicaAt(): number | null {
  const v = typeof localStorage !== 'undefined' ? Number(localStorage.getItem(REPLICA_AT_KEY)) : 0;
  return v > 0 ? v : null;
}

const emptySpec = (tableName: string): QuerySpec => ({
  tableName,
  action: 'select',
  selectColumns: '*',
  selectOpts: null,
  insertData: null,
  updateData: null,
  upsertData: null,
  upsertOpts: {},
  filters: [],
  order: [],
  limit: null,
  range: null,
  rpcName: null,
  rpcParams: {},
  single: false,
  maybeSingle: false,
});

let refreshing: Promise<boolean> | null = null;

/**
 * Télécharge toutes les tables de l'espace, puis réapplique les modifications encore en
 * attente d'envoi (pour qu'elles restent visibles). Renvoie false si le réseau manque.
 */
export function refreshReplica(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const results = await Promise.all(
        REPLICA_TABLES.map(async (table) => {
          const res = await fetch('/api/db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(emptySpec(table)),
          });
          if (res.status === 401) throw new Error('session');
          if (!res.ok) return null; // table non autorisée pour ce rôle : ignorée
          const json = await res.json();
          return { table, rows: (Array.isArray(json.data) ? json.data : []) as Row[] };
        })
      );
      const at = Date.now();
      for (const r of results) if (r) await tablePut(r.table, r.rows, at);
      // Modifications pas encore envoyées : toujours visibles sur l'appareil
      for (const item of await queueAll()) await applyLocal(item.spec as unknown as QuerySpec, { silent: true });
      localStorage.setItem(REPLICA_AT_KEY, String(at));
      localStorage.setItem('optispace:offline-last-sync', String(at));
      window.dispatchEvent(new Event(OFFLINE_EVENTS.replicaUpdated));
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/**
 * Session vérifiée en ligne : mémorisée pour rester connecté hors ligne. Si un autre compte
 * était mémorisé sur l'appareil, ses données sont d'abord effacées. Puis la copie locale est
 * téléchargée (espace client seulement) si elle manque ou date. user null : déconnecté.
 */
export async function startOfflineSession(
  user: { id: string; organization_id?: string | null } | null,
  { maxAge = 0 }: { maxAge?: number } = {}
): Promise<void> {
  if (!user) {
    rememberSessionUser(null);
    return;
  }
  const previous = cachedSessionUser<{ id?: string }>();
  if (previous?.id && previous.id !== user.id) await clearOfflineData();
  rememberSessionUser(user);
  if (!user.organization_id) return;
  const at = replicaAt();
  if (previous?.id !== user.id || !at || Date.now() - at >= maxAge) await refreshReplica();
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
/** Nouvelle copie quelques secondes après une modification faite en ligne */
export function scheduleReplicaRefresh(delay = 4000): void {
  if (typeof window === 'undefined') return;
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void refreshReplica();
  }, delay);
}

// ── Lectures ───────────────────────────────────────────────────────────────

const singular = (table: string) => table.replace(/s$/, '');

function parseSelect(select: string | null) {
  const nested: { alias: string; table: string; inner: boolean; columns: string[] }[] = [];
  const regex = /(\w+):(\w+)(!inner|!left)?\(([^)]*)\)/g;
  const str = select || '*';
  let m: RegExpExecArray | null;
  while ((m = regex.exec(str)) !== null) {
    nested.push({
      alias: m[1],
      table: m[2],
      inner: m[3] === '!inner',
      columns: !m[4] || m[4].trim() === '*' ? [] : m[4].split(',').map((c) => c.trim()).filter(Boolean),
    });
  }
  const main = str.replace(regex, '').split(',').map((s) => s.trim()).filter(Boolean);
  return { main: main.length === 0 || main.includes('*') ? [] : main, nested };
}

function pick(row: Row, columns: string[]): Row {
  if (columns.length === 0) return { ...row };
  const out: Row = {};
  for (const c of columns) out[c] = row[c] ?? null;
  return out;
}

function compare(a: any, b: any): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  const na = Number(a);
  const nb = Number(b);
  if (typeof a !== 'boolean' && a !== '' && b !== '' && !Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

function likeToRegex(pattern: string, insensitive: boolean): RegExp {
  const src = String(pattern)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/%/g, '.*')
    .replace(/_/g, '.');
  return new RegExp(`^${src}$`, insensitive ? 'is' : 's');
}

function matchFilter(row: Row, f: QuerySpec['filters'][number]): boolean {
  const v = row[f.column];
  // Comme en SQL : une comparaison avec NULL n'est jamais vraie
  if (v === null || v === undefined) return false;
  switch (f.operator) {
    case '=':
      return f.value !== null && compare(v, f.value) === 0;
    case '!=':
      return f.value !== null && compare(v, f.value) !== 0;
    case '>':
      return compare(v, f.value) > 0;
    case '>=':
      return compare(v, f.value) >= 0;
    case '<':
      return compare(v, f.value) < 0;
    case '<=':
      return compare(v, f.value) <= 0;
    case 'LIKE':
      return likeToRegex(f.value, false).test(String(v));
    case 'ILIKE':
      return likeToRegex(f.value, true).test(String(v));
    case 'IN':
      return Array.isArray(f.value) && f.value.some((x: any) => compare(v, x) === 0);
    default:
      return false;
  }
}

function matches(row: Row, filters: QuerySpec['filters']): boolean {
  const and = filters.filter((f) => f.logic === 'and');
  const or = filters.filter((f) => f.logic === 'or');
  return and.every((f) => matchFilter(row, f)) && (or.length === 0 || or.some((f) => matchFilter(row, f)));
}

async function rowsOf(table: string): Promise<Row[] | null> {
  return ((await tableGet(table))?.rows as Row[] | undefined) ?? null;
}

/**
 * Exécute une lecture sur la copie locale, comme le ferait /api/db.
 * Renvoie null si la table n'est pas gardée sur l'appareil.
 */
export async function runLocal(spec: QuerySpec): Promise<{ data: any; error: null; count?: number } | null> {
  if (spec.action !== 'select') return null;
  const base = await rowsOf(spec.tableName);
  if (!base) return null;
  const { main, nested } = parseSelect(spec.selectColumns);

  let rows = base.filter((r) => matches(r, spec.filters));
  // Tri sur les colonnes de la table principale, avant la projection
  if (spec.order.length > 0) {
    rows.sort((a, b) => {
      for (const o of spec.order) {
        const c = compare(a[o.column], b[o.column]);
        if (c !== 0) return o.ascending ? c : -c;
      }
      return 0;
    });
  }

  // Jointures : même règle que le serveur (resolveFk)
  const joined: Row[] = [];
  const children: Record<string, Row[]> = {};
  for (const n of nested) children[n.alias] = (await rowsOf(n.table)) || [];
  for (const r of rows) {
    const out = pick(r, main);
    let keep = true;
    for (const n of nested) {
      const list = children[n.alias];
      const childFk = `${singular(spec.tableName)}_id`;
      const isArray = list.length > 0 ? childFk in list[0] : !(`${n.alias}_id` in r);
      if (isArray) {
        const found = list.filter((c) => c[childFk] === r.id).map((c) => pick(c, n.columns));
        out[n.alias] = found;
        if (n.inner && found.length === 0) keep = false;
      } else {
        const ref = r[`${n.alias}_id`];
        const found = ref == null ? undefined : list.find((c) => c.id === ref);
        out[n.alias] = found ? pick(found, n.columns) : null;
        if (n.inner && !found) keep = false;
      }
    }
    if (keep) joined.push(out);
  }
  rows = joined;

  const count = rows.length;
  if (spec.selectOpts?.head) return { data: null, error: null, count };
  if (spec.limit) rows = rows.slice(0, spec.limit);
  if (spec.range) rows = rows.slice(spec.range.start, spec.range.end + 1);

  const withCount = spec.selectOpts?.count === 'exact' ? { count } : {};
  if (spec.single || spec.maybeSingle) return { data: rows[0] ?? null, error: null, ...withCount };
  return { data: rows, error: null, ...withCount };
}

// ── Modifications ──────────────────────────────────────────────────────────

function organizationId(): string | null {
  try {
    const user = JSON.parse(localStorage.getItem('optispace:offline-session') || 'null');
    return user?.organization_id ?? user?.app_metadata?.organization_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Applique une modification à la copie locale (hors ligne) et renvoie les lignes concernées.
 * silent : pas d'événement (réapplication après une nouvelle copie).
 */
export async function applyLocal(spec: QuerySpec, { silent = false } = {}): Promise<Row[]> {
  const table = spec.tableName;
  const entry = await tableGet(table);
  const rows = ((entry?.rows as Row[]) || []).slice();
  const now = new Date().toISOString();
  let touched: Row[] = [];

  const prepareNew = (data: Row): Row => {
    const row: Row = { ...DEFAULTS[table], ...data };
    if (!row.id) row.id = crypto.randomUUID();
    if (!row.created_at) row.created_at = now;
    if ('updated_at' in (rows[0] || {}) && !row.updated_at) row.updated_at = now;
    // Le serveur impose l'organisation de l'utilisateur
    if (!row.organization_id && table !== 'organizations') {
      const org = organizationId() ?? rows.find((r) => r.organization_id)?.organization_id ?? null;
      if (org) row.organization_id = org;
    }
    computeColumns(table, row);
    return row;
  };

  if (spec.action === 'insert') {
    const list = (Array.isArray(spec.insertData) ? spec.insertData : [spec.insertData]).filter(Boolean) as Row[];
    touched = list.map(prepareNew);
    for (const r of touched) {
      const i = rows.findIndex((x) => x.id === r.id);
      if (i >= 0) rows[i] = r;
      else rows.push(r);
    }
  } else if (spec.action === 'upsert') {
    const list = (Array.isArray(spec.upsertData) ? spec.upsertData : [spec.upsertData]).filter(Boolean) as Row[];
    const keys = (spec.upsertOpts?.onConflict || 'id').split(',').map((k) => k.trim());
    for (const data of list) {
      const i = rows.findIndex((x) => keys.every((k) => data[k] !== undefined && compare(x[k], data[k]) === 0));
      if (i >= 0) {
        rows[i] = { ...rows[i], ...data, updated_at: now };
        computeColumns(table, rows[i]);
        touched.push(rows[i]);
      } else {
        const r = prepareNew(data);
        rows.push(r);
        touched.push(r);
      }
    }
  } else if (spec.action === 'update') {
    for (let i = 0; i < rows.length; i++) {
      if (!matches(rows[i], spec.filters)) continue;
      rows[i] = { ...rows[i], ...(spec.updateData || {}) };
      if ('updated_at' in rows[i]) rows[i].updated_at = now;
      computeColumns(table, rows[i]);
      touched.push(rows[i]);
    }
  } else if (spec.action === 'delete') {
    touched = rows.filter((r) => matches(r, spec.filters));
    const gone = new Set(touched);
    rows.splice(0, rows.length, ...rows.filter((r) => !gone.has(r)));
  }

  await tablePut(table, rows, entry?.at);
  if (!silent) window.dispatchEvent(new Event(OFFLINE_EVENTS.replicaUpdated));
  return touched;
}
