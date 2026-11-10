'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Download, Loader2, Phone, Trash2, UserX, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { formatDateFR } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

interface DeletionRequestRow {
  id: string;
  organization_id: string | null;
  organization_name: string;
  requester_name: string | null;
  requester_email: string | null;
  reason: string | null;
  export_acknowledged: boolean;
  status: 'pending' | 'completed' | 'rejected' | 'cancelled';
  requested_at: string;
  processed_at: string | null;
  decision_note: string | null;
  deleted_summary: Record<string, number> | null;
  processed_by_name: string | null;
  organization_phone: string | null;
  organization_created_at: string | null;
  members: number;
  points_of_sale: number;
  collections: number;
}

const STATUS: Record<DeletionRequestRow['status'], { label: string; variant: 'warning' | 'success' | 'neutral' | 'danger' }> = {
  pending: { label: 'En attente', variant: 'warning' },
  completed: { label: 'Supprimé', variant: 'neutral' },
  rejected: { label: 'Refusée', variant: 'danger' },
  cancelled: { label: 'Annulée par le client', variant: 'neutral' },
};

const SUMMARY_LABELS: Record<string, string> = {
  users: 'comptes',
  wifi_spaces: 'zones',
  points_of_sale: 'points de vente',
  ticket_types: 'types de tickets',
  ticket_allocations: 'allocations',
  collections: 'collectes',
  collection_items: 'lignes de collecte',
  subscriptions: 'abonnements',
  invoices: 'factures',
  payments: 'paiements',
  license_requests: 'demandes de licence',
  support_tickets: 'tickets de support',
  login_history: 'connexions enregistrées',
};

export default function DeletionRequestsPage() {
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [rows, setRows] = useState<DeletionRequestRow[] | null>(null);
  const [approving, setApproving] = useState<DeletionRequestRow | null>(null);
  const [rejecting, setRejecting] = useState<DeletionRequestRow | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/platform/deletion-requests?status=${filter}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => !cancelled && setRows(json.data || []))
      .catch(() => !cancelled && setRows([]));
    return () => {
      cancelled = true;
    };
  }, [filter, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const closeModals = () => {
    setApproving(null);
    setRejecting(null);
    setConfirmName('');
    setNote('');
  };

  const decide = async (row: DeletionRequestRow, action: 'approve' | 'reject') => {
    setBusy(true);
    try {
      const res = await fetch(`/api/platform/deletion-requests/${row.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note, confirm_name: confirmName }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || 'Action impossible.');
        return;
      }
      toast.success(json.message || 'Demande traitée.');
      closeModals();
      reload();
    } catch {
      toast.error('Erreur réseau.');
    } finally {
      setBusy(false);
    }
  };

  const nameOk = !!approving && confirmName.trim().toLowerCase() === approving.organization_name.trim().toLowerCase();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Suppressions de compte</h1>
          <p className="text-xs text-slate-500">
            Demandes des clients pour supprimer leur espace et leurs données. Téléchargez les données si besoin, puis
            validez (effacement définitif) ou refusez avec un motif.
          </p>
        </div>
        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 self-start">
          {(['pending', 'all'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'h-8 px-3 rounded-lg text-xs font-semibold whitespace-nowrap',
                filter === f ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
              )}
            >
              {f === 'pending' ? 'En attente' : 'Toutes les demandes'}
            </button>
          ))}
        </div>
      </div>

      {rows === null ? (
        <Card className="p-10 flex items-center justify-center gap-2 text-slate-500 hover:shadow-xs">
          <Loader2 className="w-5 h-5 animate-spin" /> Chargement…
        </Card>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center space-y-2 hover:shadow-xs">
          <UserX className="w-8 h-8 mx-auto text-slate-300" />
          <p className="font-semibold text-slate-700 dark:text-slate-200">
            {filter === 'pending' ? 'Aucune demande en attente' : 'Aucune demande de suppression'}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => {
            const status = STATUS[r.status];
            return (
              <Card key={r.id} className={cn('space-y-4 hover:shadow-xs', r.status === 'pending' && 'border-l-4 border-l-amber-500')}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{r.organization_name}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Demandée par {r.requester_name || '—'}
                      {r.requester_email ? ` · ${r.requester_email}` : ''}
                    </p>
                    {r.organization_phone && (
                      <a href={`tel:${r.organization_phone.replace(/\s/g, '')}`} className="text-sm text-slate-500 inline-flex items-center gap-1 hover:text-brand-600">
                        <Phone className="w-3.5 h-3.5" /> {r.organization_phone}
                      </a>
                    )}
                  </div>
                  <div className="flex flex-col sm:items-end gap-1 shrink-0">
                    <Badge variant={status.variant}>{status.label}</Badge>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {formatDateFR(r.requested_at)}
                    </p>
                  </div>
                </div>

                {r.reason && (
                  <p className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-sm text-slate-700 dark:text-slate-200">
                    <span className="font-semibold">Motif du client : </span>
                    {r.reason}
                  </p>
                )}

                {r.status === 'pending' && (
                  <>
                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                      {[
                        { label: 'Membres', value: r.members },
                        { label: 'Points de vente', value: r.points_of_sale },
                        { label: 'Collectes', value: r.collections },
                        { label: 'Client inscrit le', value: r.organization_created_at ? formatDateFR(r.organization_created_at) : '—' },
                      ].map((m) => (
                        <div key={m.label} className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
                          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{m.label}</dt>
                          <dd className="font-bold text-slate-900 dark:text-white">{m.value}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className={cn('text-xs flex items-center gap-1.5', r.export_acknowledged ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700')}>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {r.export_acknowledged
                        ? 'Le client a confirmé avoir téléchargé ses données (ou y renoncer).'
                        : 'Le client n’a pas confirmé avoir téléchargé ses données.'}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <a
                        href={`/api/platform/deletion-requests/${r.id}/export`}
                        className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <Download className="w-4 h-4" /> Télécharger les données
                      </a>
                      <Button variant="danger" icon={Trash2} onClick={() => setApproving(r)} className="font-semibold">
                        Supprimer définitivement
                      </Button>
                      <Button variant="ghost" icon={XCircle} onClick={() => setRejecting(r)}>
                        Refuser
                      </Button>
                    </div>
                  </>
                )}

                {r.status !== 'pending' && r.processed_at && (
                  <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                    <p>
                      Traitée le {formatDateFR(r.processed_at)}
                      {r.processed_by_name ? ` par ${r.processed_by_name}` : ''}
                      {r.decision_note ? ` — ${r.decision_note}` : ''}
                    </p>
                    {r.status === 'completed' && r.deleted_summary && (
                      <p className="text-xs text-slate-500">
                        Effacé :{' '}
                        {Object.entries(r.deleted_summary)
                          .filter(([k, n]) => n > 0 && SUMMARY_LABELS[k])
                          .map(([k, n]) => `${n} ${SUMMARY_LABELS[k]}`)
                          .join(', ') || 'espace sans données'}
                      </p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Validation : effacement définitif */}
      <Modal isOpen={!!approving} onClose={closeModals} title="Supprimer définitivement">
        {approving && (
          <div className="space-y-4 text-left">
            <p className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3 text-sm text-red-800 dark:text-red-300 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              L’espace « {approving.organization_name} », ses {approving.members} compte(s) et toutes ses données
              (points de vente, collectes, factures…) seront effacés immédiatement et définitivement. Téléchargez les
              données avant si vous voulez en garder une copie.
            </p>
            <Input
              label={`Tapez le nom de l'espace : ${approving.organization_name}`}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={approving.organization_name}
              autoComplete="off"
            />
            <Input label="Note (facultatif)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. : demande vérifiée par téléphone" />
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
              <Button variant="ghost" onClick={closeModals}>
                Annuler
              </Button>
              <Button variant="danger" icon={Trash2} isLoading={busy} disabled={!nameOk || busy} onClick={() => decide(approving, 'approve')} className="font-semibold">
                Supprimer définitivement
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Refus avec motif */}
      <Modal isOpen={!!rejecting} onClose={closeModals} title="Refuser la demande">
        {rejecting && (
          <div className="space-y-4 text-left">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              L’espace « {rejecting.organization_name} » est conservé. Le client reçoit le motif par notification et par e-mail.
            </p>
            <Input label="Motif du refus" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. : facture impayée à régler avant la suppression" />
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
              <Button variant="ghost" onClick={closeModals}>
                Annuler
              </Button>
              <Button isLoading={busy} disabled={!note.trim() || busy} onClick={() => decide(rejecting, 'reject')} className="font-semibold">
                Refuser la demande
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
