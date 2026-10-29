'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, ChevronDown, ChevronRight, Clock, History, Loader2, User } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { DateField } from '@/components/ui/DateField';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { PlatformAuditLogWithUser } from '@/types/platform';
import {
  AUDIT_CATEGORIES,
  AUDIT_ENTITY_LABELS,
  auditActionInfo,
  auditChanges,
  auditSummary,
  settingLabel,
} from '@/lib/audit-labels';

const dateTime = (d: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
const longDateTime = (d: string) =>
  new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(d));

// Auteur supprimé depuis (ancien compte) : l'action reste visible, sans nom
const authorName = (log: PlatformAuditLogWithUser) =>
  log.platform_user?.full_name || log.platform_user?.email || 'Auteur non enregistré';

export default function PlatformAuditLogsPage() {
  const [category, setCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selected, setSelected] = useState<PlatformAuditLogWithUser | null>(null);
  // Résultats associés aux filtres qui les ont produits : « chargement » tant qu'ils diffèrent
  const filtersKey = `${category}|${startDate}|${endDate}`;
  const [result, setResult] = useState<{ key: string; logs: PlatformAuditLogWithUser[] } | null>(null);
  const loading = result?.key !== filtersKey;
  const logs = result?.logs ?? [];

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (category) params.set('entity_type', category);
    if (startDate) params.set('start_date', startDate);
    // Date de fin incluse : jusqu'à la fin de la journée
    if (endDate) params.set('end_date', `${endDate}T23:59:59.999`);
    fetch(`/api/platform/audit-logs?${params}`)
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => !cancelled && setResult({ key: filtersKey, logs: json.data || [] }))
      .catch(() => !cancelled && setResult({ key: filtersKey, logs: [] }));
    return () => {
      cancelled = true;
    };
  }, [category, startDate, endDate, filtersKey]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Journal d&apos;audit</h1>
        <p className="text-xs text-slate-500">Historique des actions du back-office. Touchez une ligne pour voir le détail.</p>
      </div>

      {/* Filtres */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <CustomSelect
            label="Catégorie"
            value={category}
            onChange={setCategory}
            options={AUDIT_CATEGORIES}
            searchable={false}
          />
          <DateField label="Date de début" value={startDate} onChange={setStartDate} max={endDate || undefined} clearable />
          <DateField label="Date de fin" value={endDate} onChange={setEndDate} min={startDate || undefined} clearable />
        </div>
      </Card>

      {loading ? (
        <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          <span>Chargement du journal…</span>
        </div>
      ) : logs.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <History className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucune action enregistrée</h3>
          <p className="text-xs text-slate-500">Modifiez les filtres pour élargir la recherche.</p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ResponsiveTable>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Par</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Détail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {logs.map((log) => {
                  const info = auditActionInfo(log.action);
                  const summary = auditSummary(log);
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelected(log)}
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="px-4 py-3">
                        <Badge variant={info.tone} className="text-xs">
                          {info.label}
                        </Badge>
                        {summary && <p className="mt-1 text-slate-500 line-clamp-1">{summary}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{log.organization?.name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{authorName(log)}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{dateTime(log.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(log);
                          }}
                          className="inline-flex items-center gap-1 h-9 px-3 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                        >
                          Voir <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ResponsiveTable>
        </Card>
      )}

      <AuditDetail log={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

/** Détail d'une action : panneau du bas sur mobile, fenêtre centrée sur ordinateur. */
function AuditDetail({ log, onClose }: { log: PlatformAuditLogWithUser | null; onClose: () => void }) {
  const [showRaw, setShowRaw] = useState(false);
  const info = log ? auditActionInfo(log.action) : null;
  const changes = log ? auditChanges(log.old_data, log.new_data, log.entity_type, log.entity_id) : [];
  const isCreation = !!log && !log.old_data && !!log.new_data;
  const isDeletion = !!log && !!log.old_data && (!log.new_data || (log.new_data as unknown) === 'null');

  return (
    <Modal
      isOpen={!!log}
      onClose={() => {
        setShowRaw(false);
        onClose();
      }}
      title={info?.label ?? 'Détail'}
    >
      {log && info && (
        <div className="space-y-5">
          {/* Contexte */}
          <dl className="grid gap-3 text-sm">
            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Date</dt>
                <dd className="text-slate-900 dark:text-white first-letter:uppercase">{longDateTime(log.created_at)}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <User className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Par</dt>
                <dd className="text-slate-900 dark:text-white">
                  {authorName(log)}
                  {log.platform_user?.email && log.platform_user.full_name && (
                    <span className="block text-xs text-slate-500">{log.platform_user.email}</span>
                  )}
                </dd>
              </div>
            </div>
            {(log.organization?.name || log.organization_id) && (
              <div className="flex items-start gap-3">
                <Building2 className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Client</dt>
                  <dd>
                    {log.organization_id ? (
                      <Link
                        href={`/platform/clients/${log.organization_id}`}
                        className="font-semibold text-brand-700 dark:text-brand-300 hover:underline"
                      >
                        {log.organization?.name || 'Voir le client'}
                      </Link>
                    ) : (
                      log.organization?.name
                    )}
                  </dd>
                </div>
              </div>
            )}
            {log.entity_type && (
              <div className="flex items-start gap-3">
                <History className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Élément concerné</dt>
                  <dd className="text-slate-900 dark:text-white">
                    {AUDIT_ENTITY_LABELS[log.entity_type] || log.entity_type}
                    {log.entity_type === 'platform_settings' && log.entity_id ? ` : ${settingLabel(log.entity_id)}` : ''}
                  </dd>
                </div>
              </div>
            )}
          </dl>

          {/* Ce qui a changé */}
          <section className="space-y-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {isCreation ? 'Informations enregistrées' : isDeletion ? 'Informations supprimées' : 'Ce qui a changé'}
            </h4>
            {changes.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun détail enregistré pour cette action.</p>
            ) : (
              <ul className="rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800 overflow-hidden">
                {changes.map((c) => (
                  <li key={c.key} className="px-4 py-3 space-y-1">
                    <p className="text-xs font-semibold text-slate-500">{c.label}</p>
                    {c.before !== null && c.after !== null ? (
                      <p className="text-sm flex flex-wrap items-center gap-x-2 gap-y-1 break-words">
                        <span className="text-slate-500 line-through decoration-slate-400/70">{c.before}</span>
                        <ArrowRight className="w-4 h-4 shrink-0 text-slate-400" aria-label="devient" />
                        <span className="font-semibold text-slate-900 dark:text-white">{c.after}</span>
                      </p>
                    ) : (
                      <p className="text-sm font-semibold text-slate-900 dark:text-white break-words">{c.after ?? c.before}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Données techniques, repliées */}
          <section>
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              aria-expanded={showRaw}
              className="inline-flex items-center gap-1.5 h-9 -ml-2 px-2 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${showRaw ? 'rotate-180' : ''}`} />
              Données techniques
            </button>
            {showRaw && (
              <div className="mt-2 space-y-2">
                <p className="text-[11px] text-slate-500">
                  Action : <span className="font-mono">{log.action}</span>
                  {log.entity_id && (
                    <>
                      {' '}
                      · Identifiant : <span className="font-mono break-all">{log.entity_id}</span>
                    </>
                  )}
                  {log.ip_address && (
                    <>
                      {' '}
                      · IP : <span className="font-mono">{log.ip_address}</span>
                    </>
                  )}
                </p>
                <pre className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 overflow-x-auto max-h-64">
                  {JSON.stringify({ avant: log.old_data ?? null, apres: log.new_data ?? null }, null, 2)}
                </pre>
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
