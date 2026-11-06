'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, CheckCircle2, ClipboardCheck, Clock, Loader2, Trash2, X, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { formatCurrencyFCFA, formatDateFR } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

interface ChangeRequest {
  id: string;
  entity_type: 'collection' | 'allocation';
  entity_id: string;
  action: 'update' | 'delete';
  changes: Record<string, unknown> | null;
  previous: Record<string, unknown> | null;
  label: string | null;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requested_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  requested_by_name: string | null;
  reviewed_by_name: string | null;
}

const FIELD_LABELS: Record<string, string> = {
  montant_collecte: 'Montant encaissé',
  commission: 'Commission',
  date_collecte: 'Date de collecte',
  notes: 'Notes',
  quantite: 'Quantité',
  date_allocation: "Date d'allocation",
};

const STATUS: Record<ChangeRequest['status'], { label: string; variant: 'warning' | 'success' | 'danger' | 'neutral' }> = {
  pending: { label: 'En attente', variant: 'warning' },
  approved: { label: 'Validée', variant: 'success' },
  rejected: { label: 'Refusée', variant: 'danger' },
  cancelled: { label: 'Annulée', variant: 'neutral' },
};

function show(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'montant_collecte' || field === 'commission') return formatCurrencyFCFA(Number(value));
  if (field.startsWith('date_')) return new Date(String(value)).toLocaleDateString('fr-FR');
  return String(value);
}

const detailHref = (r: ChangeRequest) => (r.entity_type === 'collection' ? `/collections/${r.entity_id}` : `/allocations/${r.entity_id}`);

/**
 * Corrections demandées par les collecteurs (collecte, allocation) : l'administrateur compare
 * avant / après et valide (appliqué tout de suite) ou refuse avec un motif. Le collecteur
 * suit ici ses propres demandes.
 */
export default function ChangeRequestsPage() {
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [state, setState] = useState<{ rows: ChangeRequest[]; canReview: boolean } | null>(null);
  const [version, setVersion] = useState(0);
  const [rejecting, setRejecting] = useState<ChangeRequest | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/change-requests?status=${filter}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { data: [], canReview: false }))
      .then((json) => !cancelled && setState({ rows: json.data || [], canReview: !!json.canReview }))
      .catch(() => !cancelled && setState({ rows: [], canReview: false }));
    return () => {
      cancelled = true;
    };
  }, [filter, version]);

  const decide = async (r: ChangeRequest, action: 'approve' | 'reject') => {
    setBusy(r.id);
    try {
      const res = await fetch(`/api/change-requests/${r.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: action === 'reject' ? note : null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || 'Action impossible.');
        return;
      }
      toast.success(json.message);
      setRejecting(null);
      setNote('');
      setVersion((v) => v + 1);
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (r: ChangeRequest) => {
    setBusy(r.id);
    const res = await fetch(`/api/change-requests/${r.id}`, { method: 'DELETE' });
    setBusy(null);
    if (res.ok) {
      toast.success('Demande annulée.');
      setVersion((v) => v + 1);
    } else toast.error('Annulation impossible.');
  };

  const canReview = state?.canReview ?? false;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-brand-600" />
            {canReview ? 'Corrections à valider' : 'Mes demandes de correction'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {canReview
              ? 'Les collecteurs ne modifient pas directement leurs saisies : comparez avant / après, puis validez ou refusez.'
              : 'Vos corrections et suppressions sont appliquées après validation par l’administrateur de l’espace.'}
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
              {f === 'pending' ? 'En attente' : 'Historique'}
            </button>
          ))}
        </div>
      </div>

      {state === null ? (
        <Card className="p-10 flex items-center justify-center gap-2 text-slate-500 hover:shadow-xs">
          <Loader2 className="w-5 h-5 animate-spin" /> Chargement…
        </Card>
      ) : state.rows.length === 0 ? (
        <Card className="p-10 text-center space-y-2 hover:shadow-xs">
          <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
          <p className="font-semibold text-slate-700 dark:text-slate-200">
            {filter === 'pending' ? 'Aucune correction en attente' : 'Aucune demande de correction'}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {state.rows.map((r) => {
            const status = STATUS[r.status];
            const fields = r.action === 'update' ? Object.keys(r.changes || {}) : [];
            return (
              <Card key={r.id} className={cn('space-y-4 hover:shadow-xs', r.status === 'pending' && 'border-l-4 border-l-amber-500')}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      {r.action === 'delete' ? <Trash2 className="w-3.5 h-3.5 text-red-500" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                      {r.action === 'delete' ? 'Suppression demandée' : 'Correction demandée'}
                      {canReview && r.requested_by_name ? ` par ${r.requested_by_name}` : ''}
                    </p>
                    <Link href={detailHref(r)} className="font-bold text-slate-900 dark:text-white hover:text-brand-600">
                      {r.label || (r.entity_type === 'collection' ? 'Collecte' : 'Allocation')}
                    </Link>
                  </div>
                  <div className="flex sm:flex-col sm:items-end gap-2 shrink-0">
                    <Badge variant={status.variant}>{status.label}</Badge>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {formatDateFR(r.requested_at)}
                    </span>
                  </div>
                </div>

                {r.reason && (
                  <p className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-sm text-slate-700 dark:text-slate-200">
                    <span className="font-semibold">Motif : </span>« {r.reason} »
                  </p>
                )}

                {/* Avant → après */}
                {fields.length > 0 && (
                  <div className="space-y-1.5">
                    {fields.map((f) => (
                      <div key={f} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-slate-500 w-36 shrink-0">{FIELD_LABELS[f] ?? f}</span>
                        <span className="line-through text-slate-400 tabular-nums">{show(f, r.previous?.[f])}</span>
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                        <span className="font-bold text-slate-900 dark:text-white tabular-nums">{show(f, r.changes?.[f])}</span>
                      </div>
                    ))}
                  </div>
                )}
                {r.action === 'delete' && (
                  <p className="text-sm text-red-700 dark:text-red-400">
                    {r.entity_type === 'collection'
                      ? 'La collecte et ses lignes seront supprimées.'
                      : 'L’allocation sera supprimée (le stock du point de vente diminue d’autant).'}
                  </p>
                )}

                {r.status === 'pending' && canReview && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      icon={Check}
                      isLoading={busy === r.id}
                      disabled={!!busy}
                      onClick={() => decide(r, 'approve')}
                      className={cn('font-semibold', r.action === 'delete' && 'bg-red-600 hover:bg-red-700')}
                    >
                      {r.action === 'delete' ? 'Valider la suppression' : 'Valider la correction'}
                    </Button>
                    <Button variant="outline" icon={X} disabled={!!busy} onClick={() => (setNote(''), setRejecting(r))}>
                      Refuser
                    </Button>
                  </div>
                )}
                {r.status === 'pending' && !canReview && (
                  <Button variant="outline" size="sm" icon={XCircle} isLoading={busy === r.id} onClick={() => cancel(r)} className="self-start">
                    Annuler ma demande
                  </Button>
                )}
                {r.status !== 'pending' && r.reviewed_at && (
                  <p className="text-xs text-slate-500">
                    {r.status === 'cancelled' ? 'Annulée' : 'Traitée'} le {formatDateFR(r.reviewed_at)}
                    {r.reviewed_by_name ? ` par ${r.reviewed_by_name}` : ''}
                    {r.review_note ? ` — ${r.review_note}` : ''}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal isOpen={!!rejecting} onClose={() => setRejecting(null)} title="Refuser la correction">
        {rejecting && (
          <div className="space-y-4 text-left">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              La saisie reste inchangée. Le collecteur reçoit votre motif.
            </p>
            <Input label="Motif du refus" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. : le montant compté était bien de 150" />
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
              <Button variant="ghost" onClick={() => setRejecting(null)}>
                Annuler
              </Button>
              <Button isLoading={busy === rejecting.id} disabled={!note.trim() || !!busy} onClick={() => decide(rejecting, 'reject')} className="font-semibold">
                Refuser
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
