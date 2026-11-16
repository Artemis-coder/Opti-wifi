'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Download, FileJson, Loader2, ShieldAlert, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { confirmAction } from '@/components/ui/ConfirmDialog';
import { formatDateFR } from '@/lib/utils/format';

interface DeletionRequest {
  id: string;
  status: 'pending' | 'completed' | 'rejected' | 'cancelled';
  reason: string | null;
  requested_at: string;
  processed_at: string | null;
  decision_note: string | null;
}

/** Télécharge le fichier renvoyé par l'API (export JSON) */
async function downloadExport(): Promise<boolean> {
  const res = await fetch('/api/account/export', { cache: 'no-store' });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    toast.error(json.error || 'Téléchargement impossible.');
    return false;
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || 'optispace-donnees.json';
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}

const DELETED_ITEMS = [
  'votre espace et tous les comptes de votre équipe (administrateurs et collecteurs)',
  'vos zones, points de vente et types de tickets',
  'vos allocations, collectes et tout l’historique des encaissements',
  'vos abonnements, factures et demandes de licence',
  'vos échanges avec le support',
];

/**
 * Paramètres > Données & compte : téléchargement de toutes les données de l'espace et zone de
 * danger (demande de suppression du compte, validée ensuite par l'équipe OptiSpace).
 */
export function AccountDataSection({ organizationName, isAdmin }: { organizationName: string; isAdmin: boolean }) {
  const [request, setRequest] = useState<DeletionRequest | null | undefined>(undefined);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    fetch('/api/account/deletion', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { data: null }))
      .then((json) => !cancelled && setRequest(json.data ?? null))
      .catch(() => !cancelled && setRequest(null));
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <Card className="flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-muted shrink-0 mt-0.5" />
        <p className="text-sm text-muted">
          Le téléchargement des données et la suppression du compte sont réservés à l’administrateur de l’espace.
          Pour quitter l’équipe, demandez-lui de retirer votre accès.
        </p>
      </Card>
    );
  }

  const download = async () => {
    setDownloading(true);
    try {
      if (await downloadExport()) {
        setDownloaded(true);
        setAcknowledged(true);
        toast.success('Vos données ont été téléchargées.');
      }
    } finally {
      setDownloading(false);
    }
  };

  const closeModal = () => {
    setOpen(false);
    setConfirmName('');
    setPassword('');
    setReason('');
  };

  const nameOk = confirmName.trim().toLowerCase() === organizationName.trim().toLowerCase() && !!organizationName;
  const canSend = nameOk && password.length > 0 && acknowledged && !sending;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    setSending(true);
    try {
      const res = await fetch('/api/account/deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm_name: confirmName, password, reason, export_acknowledged: acknowledged }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || 'Envoi impossible.');
        return;
      }
      setRequest(json.data);
      closeModal();
      toast.success('Demande de suppression envoyée. Vous recevrez une confirmation une fois traitée.');
    } catch {
      toast.error('Erreur réseau : réessayez.');
    } finally {
      setSending(false);
    }
  };

  const cancelRequest = async () => {
    const ok = await confirmAction('Votre espace et vos données seront conservés.', {
      title: 'Annuler la demande de suppression ?',
      confirmLabel: 'Annuler la demande',
    });
    if (!ok) return;
    setCancelling(true);
    try {
      const res = await fetch('/api/account/deletion', { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || 'Annulation impossible.');
        return;
      }
      setRequest(json.data);
      toast.success('Demande annulée : votre espace est conservé.');
    } finally {
      setCancelling(false);
    }
  };

  const pending = request?.status === 'pending';

  return (
    <>
      {/* Télécharger ses données */}
      <Card className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 shrink-0 rounded-lg bg-accent-soft text-accent flex items-center justify-center">
            <FileJson className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">Télécharger mes données</h3>
            <p className="text-sm text-muted">
              Un fichier avec toutes les données de votre espace : équipe, zones, points de vente, types de tickets,
              allocations, collectes, abonnements, factures et support. Gardez-le précieusement avant toute suppression.
            </p>
          </div>
        </div>
        <Button variant="outline" icon={Download} isLoading={downloading} onClick={download} className="w-full sm:w-auto font-semibold">
          {downloaded ? 'Télécharger à nouveau' : 'Télécharger mes données'}
        </Button>
      </Card>

      {/* Zone de danger */}
      <section className="rounded-xl border-2 bg-danger-soft p-5 space-y-4" aria-labelledby="danger-title">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 shrink-0 rounded-lg bg-danger-soft text-danger flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h3 id="danger-title" className="text-base font-semibold text-danger">
              Zone de danger
            </h3>
            <p className="text-sm text-muted">Supprimer votre compte et toutes les données de votre espace.</p>
          </div>
        </div>

        {request === undefined ? (
          <p className="text-sm text-muted flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
          </p>
        ) : pending ? (
          <div className="rounded-xl bg-surface border border-warning/30 p-4 space-y-3">
            <p className="font-semibold text-warning-soft-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" /> Demande de suppression en attente de validation
            </p>
            <p className="text-sm text-muted">
              Envoyée le {formatDateFR(request.requested_at)}. Notre équipe va la traiter : vous recevrez un e-mail une fois
              la suppression effectuée. D’ici là, votre espace reste accessible et vous pouvez encore télécharger vos
              données ou annuler la demande.
            </p>
            <Button variant="outline" icon={XCircle} isLoading={cancelling} onClick={cancelRequest} className="w-full sm:w-auto font-semibold">
              Annuler ma demande
            </Button>
          </div>
        ) : (
          <>
            {request?.status === 'rejected' && (
              <p className="rounded-xl bg-surface border border-border p-3 text-sm text-muted">
                Votre demande du {formatDateFR(request.requested_at)} n’a pas été effectuée
                {request.decision_note ? ` : ${request.decision_note}` : '.'}
              </p>
            )}
            <div className="text-sm text-foreground space-y-2">
              <p>La suppression est <strong>définitive</strong>. Seront effacés :</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {DELETED_ITEMS.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              <p>
                Votre demande est d’abord vérifiée par l’équipe OptiSpace, puis la suppression est effectuée. Vous pouvez
                l’annuler tant qu’elle n’est pas traitée.
              </p>
            </div>
            <Button variant="danger" icon={Trash2} onClick={() => setOpen(true)} className="w-full sm:w-auto font-semibold">
              Supprimer mon compte
            </Button>
          </>
        )}
      </section>

      {/* Confirmation */}
      <Modal isOpen={open} onClose={closeModal} title="Supprimer mon compte et mes données">
        <form onSubmit={send} className="space-y-4 text-left">
          <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            Après validation par notre équipe, l’espace « {organizationName} » et toutes ses données seront effacés
            définitivement. Personne ne pourra les récupérer.
          </p>

          {/* 1. Données */}
          <div className="rounded-xl border border-border p-3 space-y-2">
            <p className="text-sm font-semibold text-foreground">1. Récupérez vos données</p>
            <Button type="button" variant="outline" size="sm" icon={downloaded ? CheckCircle2 : Download} isLoading={downloading} onClick={download}>
              {downloaded ? 'Données téléchargées' : 'Télécharger mes données'}
            </Button>
            <label className="flex items-start gap-2 text-sm text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-red-600"
              />
              J’ai téléchargé mes données, ou je renonce à les garder.
            </label>
          </div>

          {/* 2. Motif */}
          <div className="space-y-1.5">
            <label htmlFor="deletion-reason" className="block text-xs sm:text-xs font-semibold text-muted">
              2. Pourquoi partez-vous ? (facultatif)
            </label>
            <textarea
              id="deletion-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Votre avis nous aide à améliorer OptiSpace."
              className="w-full rounded-field border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>

          {/* 3. Nom de l'espace */}
          <Input
            label={`3. Tapez le nom de votre espace : ${organizationName}`}
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={organizationName}
            autoComplete="off"
            error={confirmName && !nameOk ? 'Le nom ne correspond pas.' : undefined}
          />

          {/* 4. Mot de passe */}
          <Input
            label="4. Votre mot de passe"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row justify-end pt-1">
            <Button type="button" variant="ghost" onClick={closeModal}>
              Annuler
            </Button>
            <Button type="submit" variant="danger" icon={Trash2} isLoading={sending} disabled={!canSend} className="font-semibold">
              Envoyer la demande de suppression
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
