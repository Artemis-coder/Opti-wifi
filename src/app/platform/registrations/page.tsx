'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { UserPlus, Loader2, CheckCircle, XCircle, Mail, Phone, Search, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Button, buttonClassName } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { LicenseActivationModal } from '@/components/platform/LicenseActivationModal';
import { formatDateFR, formatDateOnlyFR } from '@/lib/utils/format';
import type { OrganizationStatus } from '@/types/platform';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';

interface Registration {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  status: OrganizationStatus;
  created_at: string;
  plan_name: string;
}

type Tab = 'pending_approval' | 'all';

const STATUS_LABELS: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  pending_approval: { label: 'En attente', variant: 'warning' },
  trial: { label: 'Essai', variant: 'info' },
  active: { label: 'Actif', variant: 'success' },
  expiring: { label: 'Expire bientôt', variant: 'warning' },
  expired: { label: 'Expiré', variant: 'danger' },
  suspended: { label: 'Désactivé', variant: 'danger' },
  cancelled: { label: 'Refusé', variant: 'neutral' },
  archived: { label: 'Archivé', variant: 'neutral' },
};

export default function PlatformRegistrationsPage() {
  const [tab, setTab] = useState<Tab>('pending_approval');
  const [rows, setRows] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Registration | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [licenseFor, setLicenseFor] = useState<Registration | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/platform/clients?${new URLSearchParams({ status: tab, limit: '200' }).toString()}`)
      .then(async (res) => ({ ok: res.ok, result: await res.json() }))
      .then(({ ok, result }) => {
        if (cancelled) return;
        if (ok) setRows(result.data || []);
        else toast.error(result.error || 'Erreur de chargement');
      })
      .catch(() => {
        if (!cancelled) toast.error('Erreur réseau');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, reloadKey]);

  async function runAction(org: Registration, action: 'approve' | 'cancel', reason?: string) {
    setBusyId(org.id);
    try {
      const res = await fetch('/api/platform/clients/action', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: org.id, action, reason }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || 'Action impossible');
        return false;
      }
      return { trial: (result.trial ?? null) as { days: number; end_date: string } | null };
    } catch {
      toast.error('Erreur réseau');
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function handleApprove(org: Registration) {
    const result = await runAction(org, 'approve');
    if (!result) return;
    if (result.trial) {
      // Essai gratuit démarré automatiquement (durée du forfait d'essai)
      toast.success(
        `Compte « ${org.name} » validé : essai gratuit de ${result.trial.days} jour${result.trial.days > 1 ? 's' : ''} jusqu'au ${formatDateOnlyFR(result.trial.end_date)}`
      );
    } else {
      toast.success(`Compte « ${org.name} » validé`);
      setLicenseFor(org);
    }
    reload();
  }

  async function handleReject() {
    if (!rejecting) return;
    if (await runAction(rejecting, 'cancel', rejectReason.trim() || undefined)) {
      toast.success(`Inscription « ${rejecting.name} » refusée`);
      setRejecting(null);
      setRejectReason('');
      reload();
    }
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? rows.filter((r) =>
        [r.name, r.contact_name, r.email, r.phone].some((v) => v?.toLowerCase().includes(q))
      )
    : rows;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <UserPlus className="size-6 text-muted" />
          Inscriptions
        </h1>
        <p className="text-sm text-muted mt-1">
          Comptes créés sur la plateforme. Validez une inscription pour ouvrir l&apos;espace du client.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="flex gap-2">
          <Button size="sm" variant={tab === 'pending_approval' ? 'primary' : 'outline'} onClick={() => { setLoading(true); setTab('pending_approval'); }}>
            En attente de validation
          </Button>
          <Button size="sm" variant={tab === 'all' ? 'primary' : 'outline'} onClick={() => { setLoading(true); setTab('all'); }}>
            Toutes les inscriptions
          </Button>
        </div>
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Nom, contact, email, téléphone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input--primary w-full pl-10 pr-3"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-10 flex justify-center items-center gap-2 text-muted text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-accent" />
          <span>Chargement des inscriptions...</span>
        </div>
      ) : filtered.length === 0 ? (
        <Card className="text-center space-y-2 py-8">
          <CheckCircle className="w-12 h-12 text-success-soft-foreground mx-auto" />
          <h3 className="text-base font-semibold text-foreground">
            {tab === 'pending_approval' ? 'Aucune inscription en attente' : 'Aucune inscription'}
          </h3>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ResponsiveTable>
            <table className="w-full text-left text-xs">
              <thead className="bg-default text-muted font-semibold">
                <tr>
                  <th className="px-4 py-3">Organisation</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Inscrit le</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-separator font-medium">
                {filtered.map((r) => {
                  const st = STATUS_LABELS[r.status] || { label: r.status, variant: 'neutral' as const };
                  return (
                    <tr key={r.id} className="hover:bg-surface-secondary transition">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-foreground">{r.name}</p>
                        {r.contact_name && <p className="text-muted">{r.contact_name}</p>}
                      </td>
                      <td className="px-4 py-3 text-muted space-y-0.5">
                        {r.email && (
                          <p className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{r.email}</p>
                        )}
                        {r.phone && (
                          <p className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{r.phone}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">{formatDateFR(r.created_at)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 justify-end">
                          {r.status === 'pending_approval' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleApprove(r)}
                                isLoading={busyId === r.id}
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> Valider
                              </Button>
                              <Button
                                size="sm"
                                variant="danger-soft"
                                onClick={() => setRejecting(r)}
                                disabled={busyId === r.id}
                              >
                                <XCircle className="w-3.5 h-3.5" /> Refuser
                              </Button>
                            </>
                          )}
                          <Link href={`/platform/clients/${r.id}`} title="Voir la fiche" aria-label="Voir la fiche" className={buttonClassName({ variant: 'ghost', size: 'sm', isIconOnly: true })}>
                              <Eye className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ResponsiveTable>
        </Card>
      )}

      <Modal isOpen={!!rejecting} onClose={() => setRejecting(null)} title="Refuser l'inscription">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Le client <strong>{rejecting?.name}</strong> n&apos;aura pas accès à la plateforme.
          </p>
          <textarea
            rows={3}
            maxLength={500}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Motif (optionnel)"
            className="textarea textarea--primary w-full"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejecting(null)}>Annuler</Button>
            <Button variant="danger" onClick={handleReject} isLoading={busyId === rejecting?.id}>
              Refuser l&apos;inscription
            </Button>
          </div>
        </div>
      </Modal>

      {licenseFor && (
        <LicenseActivationModal
          isOpen={!!licenseFor}
          onClose={() => setLicenseFor(null)}
          onActivated={reload}
          organizationId={licenseFor.id}
          organizationName={licenseFor.name}
          preferTrial
        />
      )}
    </div>
  );
}
