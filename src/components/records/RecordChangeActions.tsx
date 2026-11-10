'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, Pencil, Send, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DateField } from '@/components/ui/DateField';
import { Modal } from '@/components/ui/Modal';
import { confirmAction } from '@/components/ui/ConfirmDialog';
import { useAuthStore } from '@/lib/stores/authStore';
import { useReadOnly } from '@/lib/stores/accessStore';

type EntityType = 'collection' | 'allocation';

export interface CollectionValues {
  montant_collecte: number;
  commission: number;
  date_collecte: string;
  notes: string;
}
export interface AllocationValues {
  quantite: number;
  date_allocation: string;
  notes: string;
}

interface PendingRequest {
  id: string;
  entity_id: string;
  action: 'update' | 'delete';
  reason: string | null;
  requested_at: string;
  requested_by_name: string | null;
}

const API: Record<EntityType, string> = { collection: '/api/collections', allocation: '/api/allocations' };
const WHAT: Record<EntityType, string> = { collection: 'cet encaissement', allocation: 'cette allocation' };

/**
 * Corriger ou supprimer une collecte / une allocation.
 * Administrateur : appliqué tout de suite. Collecteur : demande envoyée à l'administrateur
 * (motif obligatoire), appliquée après sa validation ; la demande en attente est affichée.
 */
export function RecordChangeActions({
  type,
  id,
  values,
  onUpdated,
  onDeleted,
}: {
  type: EntityType;
  id: string;
  values: CollectionValues | AllocationValues;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'administrateur';
  // Abonnement expiré : consultation seule, ni correction ni suppression
  const readOnly = useReadOnly();
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const [version, setVersion] = useState(0);
  const [mode, setMode] = useState<'edit' | 'delete' | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  // Demande en attente pour cet élément
  useEffect(() => {
    let cancelled = false;
    fetch('/api/change-requests?status=pending', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => {
        if (!cancelled) setPending((json.data as PendingRequest[]).find((r) => r.entity_id === id) ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, version]);

  const openEdit = () => {
    setForm(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v == null ? '' : String(v)])));
    setReason('');
    setMode('edit');
  };

  const submit = async (action: 'edit' | 'delete') => {
    setBusy(true);
    try {
      const changes =
        type === 'collection'
          ? {
              montant_collecte: Number(form.montant_collecte),
              commission: Number(form.commission || 0),
              date_collecte: form.date_collecte,
              notes: form.notes,
            }
          : { quantite: Number(form.quantite), date_allocation: form.date_allocation, notes: form.notes };
      const res = await fetch(`${API[type]}/${id}`, {
        method: action === 'delete' ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'delete' ? { reason } : { changes, reason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || 'Action impossible.');
        return;
      }
      toast.success(json.message);
      setMode(null);
      if (json.applied && action === 'delete') onDeleted();
      else {
        onUpdated();
        setVersion((v) => v + 1);
      }
    } catch {
      toast.error('Connexion nécessaire pour corriger une saisie.');
    } finally {
      setBusy(false);
    }
  };

  const deleteNow = async () => {
    const ok = await confirmAction(`Supprimer définitivement ${WHAT[type]} ?`, {
      title: 'Supprimer',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (ok) await submit('delete');
  };

  const cancelRequest = async () => {
    if (!pending) return;
    const res = await fetch(`/api/change-requests/${pending.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Demande annulée.');
      onUpdated();
      setVersion((v) => v + 1);
    } else toast.error('Annulation impossible.');
  };

  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      {pending && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <Clock className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0 text-sm">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              {pending.action === 'delete' ? 'Suppression' : 'Correction'} en attente de validation
            </p>
            <p className="text-amber-800/80 dark:text-amber-300/80">
              {isAdmin ? `Demandée par ${pending.requested_by_name ?? 'un collecteur'}` : 'Envoyée à votre administrateur'}
              {pending.reason ? ` — « ${pending.reason} »` : ''}
            </p>
          </div>
          {isAdmin ? (
            <Link href="/change-requests" className="text-sm font-semibold text-amber-800 dark:text-amber-200 underline whitespace-nowrap">
              Examiner la demande
            </Link>
          ) : (
            <Button variant="outline" size="sm" icon={XCircle} onClick={cancelRequest}>
              Annuler ma demande
            </Button>
          )}
        </div>
      )}

      {!pending && !readOnly && (isAdmin || role === 'collecteur') && (
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" icon={Pencil} onClick={openEdit} className="font-semibold">
            {isAdmin ? 'Modifier' : 'Demander une correction'}
          </Button>
          <Button
            variant="outline"
            icon={Trash2}
            onClick={() => (isAdmin ? deleteNow() : (setReason(''), setMode('delete')))}
            className="font-semibold text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
          >
            {isAdmin ? 'Supprimer' : 'Demander la suppression'}
          </Button>
        </div>
      )}

      {/* Correction */}
      <Modal isOpen={mode === 'edit'} onClose={() => setMode(null)} title={isAdmin ? 'Modifier' : 'Demander une correction'}>
        <div className="space-y-4 text-left">
          {!isAdmin && (
            <p className="rounded-xl bg-brand-50 dark:bg-brand-950/30 px-3 py-2 text-sm text-brand-800 dark:text-brand-200">
              Votre correction sera appliquée après validation par l’administrateur de l’espace.
            </p>
          )}
          {type === 'collection' ? (
            <>
              <Input label="Montant encaissé (FCFA)" type="number" min={0} value={form.montant_collecte ?? ''} onChange={(e) => set('montant_collecte')(e.target.value)} />
              <Input label="Commission versée (FCFA)" type="number" min={0} value={form.commission ?? ''} onChange={(e) => set('commission')(e.target.value)} />
              <DateField label="Date de collecte" value={form.date_collecte ?? ''} onChange={set('date_collecte')} />
            </>
          ) : (
            <>
              <Input label="Quantité de tickets" type="number" min={1} value={form.quantite ?? ''} onChange={(e) => set('quantite')(e.target.value)} />
              <DateField label="Date d'allocation" value={form.date_allocation ?? ''} onChange={set('date_allocation')} />
            </>
          )}
          <Input label="Notes" value={form.notes ?? ''} onChange={(e) => set('notes')(e.target.value)} />
          {!isAdmin && (
            <Input
              label="Pourquoi cette correction ?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex. : j'ai saisi 150 au lieu de 200"
            />
          )}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
            <Button variant="ghost" onClick={() => setMode(null)}>
              Annuler
            </Button>
            <Button
              icon={isAdmin ? Pencil : Send}
              isLoading={busy}
              disabled={busy || (!isAdmin && !reason.trim())}
              onClick={() => submit('edit')}
              className="font-semibold"
            >
              {isAdmin ? 'Enregistrer' : 'Envoyer la demande'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Demande de suppression (collecteur) */}
      <Modal isOpen={mode === 'delete'} onClose={() => setMode(null)} title="Demander la suppression">
        <div className="space-y-4 text-left">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            L’administrateur de l’espace recevra votre demande et décidera de supprimer {WHAT[type]}.
          </p>
          <Input label="Pourquoi la supprimer ?" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. : saisie en double" />
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
            <Button variant="ghost" onClick={() => setMode(null)}>
              Annuler
            </Button>
            <Button variant="danger" icon={Send} isLoading={busy} disabled={busy || !reason.trim()} onClick={() => submit('delete')} className="font-semibold">
              Envoyer la demande
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
