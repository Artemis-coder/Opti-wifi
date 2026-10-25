'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Inbox, Loader2, CheckCircle, XCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { LicenseActivationModal } from '@/components/platform/LicenseActivationModal';
import { formatDateFR, formatDateOnlyFR } from '@/lib/utils/format';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';

interface LicenseRequest {
  id: string;
  type: 'renewal' | 'new' | 'upgrade';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  duration_months: number;
  message: string | null;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
  organization_id: string;
  organization_name: string;
  contact_name: string | null;
  organization_email: string | null;
  organization_phone: string | null;
  plan_id: string | null;
  plan_name: string | null;
  requested_by_name: string | null;
  current_end_date: string | null;
  current_plan_name: string | null;
}

type StatusTab = 'pending' | 'approved' | 'rejected';

const TABS: { value: StatusTab; label: string }[] = [
  { value: 'pending', label: 'En attente' },
  { value: 'approved', label: 'Approuvées' },
  { value: 'rejected', label: 'Refusées' },
];

const TYPE_LABELS: Record<LicenseRequest['type'], string> = {
  renewal: 'Renouvellement',
  new: 'Nouvelle licence',
  upgrade: 'Changement de forfait',
};

export default function LicenseRequestsPage() {
  const [tab, setTab] = useState<StatusTab>('pending');
  const [rows, setRows] = useState<LicenseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<LicenseRequest | null>(null);
  const [rejecting, setRejecting] = useState<LicenseRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/platform/license-requests?status=${tab}`)
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

  async function handleReject() {
    if (!rejecting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/platform/license-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: rejecting.id, action: 'reject', note: rejectNote }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || 'Action impossible');
        return;
      }
      toast.success('Demande refusée');
      setRejecting(null);
      setRejectNote('');
      reload();
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Inbox className="w-6 h-6 text-amber-500" />
          Demandes de licence
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Renouvellements demandés par les clients. Approuvez une demande pour activer la licence.
        </p>
      </div>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <Button key={t.value} size="sm" variant={tab === t.value ? 'primary' : 'outline'} onClick={() => { if (t.value !== tab) { setLoading(true); setTab(t.value); } }}>
            {t.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          <span>Chargement des demandes...</span>
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-12 text-center space-y-2">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucune demande</h3>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ResponsiveTable>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Demande</th>
                  <th className="px-4 py-3">Licence actuelle</th>
                  <th className="px-4 py-3">Reçue le</th>
                  <th className="px-4 py-3 text-right">{tab === 'pending' ? 'Actions' : 'Traitée le'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition align-top">
                    <td className="px-4 py-3">
                      <Link href={`/platform/clients/${r.organization_id}`} className="font-semibold text-slate-900 dark:text-white hover:text-amber-500">
                        {r.organization_name}
                      </Link>
                      <p className="text-slate-500">{r.requested_by_name || r.contact_name || '—'}</p>
                      <p className="text-slate-500">{r.organization_phone || r.organization_email || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      <Badge variant="info" className="text-xs">{TYPE_LABELS[r.type]}</Badge>
                      <p className="mt-1">
                        {r.plan_name || 'Forfait actuel'} · {r.duration_months} mois
                      </p>
                      {r.message && <p className="mt-1 italic text-slate-500">« {r.message} »</p>}
                      {r.admin_note && <p className="mt-1 text-slate-500">Note : {r.admin_note}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      <p>{r.current_plan_name || 'Aucune'}</p>
                      {r.current_end_date && (
                        <p className={new Date(r.current_end_date) < new Date() ? 'text-red-600' : 'text-slate-500'}>
                          {new Date(r.current_end_date) < new Date() ? 'Expirée le ' : "Jusqu'au "}
                          {formatDateOnlyFR(r.current_end_date)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDateFR(r.created_at)}</td>
                    <td className="px-4 py-3">
                      {tab === 'pending' ? (
                        <div className="flex gap-1.5 justify-end">
                          <Button size="sm" className="h-7 text-xs" onClick={() => setApproving(r)}>
                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approuver
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs text-red-600" onClick={() => setRejecting(r)}>
                            <XCircle className="w-3.5 h-3.5 mr-1" /> Refuser
                          </Button>
                          <Link href={`/platform/clients/${r.organization_id}`}>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" title="Voir la fiche">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        </div>
                      ) : (
                        <p className="text-right text-slate-500">{r.processed_at ? formatDateFR(r.processed_at) : '—'}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTable>
        </Card>
      )}

      {approving && (
        <LicenseActivationModal
          isOpen={!!approving}
          onClose={() => setApproving(null)}
          onActivated={reload}
          organizationId={approving.organization_id}
          organizationName={approving.organization_name}
          currentEndDate={approving.current_end_date}
          defaultPlanId={approving.plan_id}
          defaultDurationMonths={approving.duration_months}
          requestId={approving.id}
        />
      )}

      <Modal isOpen={!!rejecting} onClose={() => setRejecting(null)} title="Refuser la demande">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Demande de <strong>{rejecting?.organization_name}</strong>. Le client verra que sa demande a été refusée.
          </p>
          <textarea
            rows={3}
            maxLength={500}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Motif (optionnel, visible par le client)"
            className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejecting(null)}>Annuler</Button>
            <Button variant="danger" onClick={handleReject} isLoading={submitting}>Refuser la demande</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
