'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftRight,
  ArrowLeft,
  Loader2,
  Store,
  User,
  Calendar,
  Clock,
  Ticket,
  FileText,
  DollarSign,
  Repeat,
  Tag,
  CheckCircle2,
  ArrowDownRight,
  ArrowUpRight,
  Layers,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatAmountShort, formatCurrencyFCFA, formatDateFR, formatDateOnlyFR, formatNumber } from '@/lib/utils/format';
import { StatTile } from '@/components/ui/StatTile';
import { TicketAllocation, PointOfSale, TicketType, Profile } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { formatTicketDuration } from '@/lib/ticket-duration';
import { RecordChangeActions } from '@/components/records/RecordChangeActions';
import { RecordHistory } from '@/components/records/RecordHistory';

interface ExtendedAllocation extends TicketAllocation {
  allocateur?: Profile | null;
  exchangeOperations?: TicketAllocation[];
}

export default function AllocationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allocation, setAllocation] = useState<ExtendedAllocation | null>(null);
  const [notFound, setNotFound] = useState(false);
  // Rechargée après une correction appliquée
  const [reloadKey, setReloadKey] = useState(0);
  const supabase = createClient();

  const allocationId = typeof params?.id === 'string'
    ? params.id
    : Array.isArray(params?.id)
    ? params.id[0]
    : '';

  useEffect(() => {
    if (!allocationId) return;

    async function loadDetail() {
      setLoading(true);
      setNotFound(false);

      try {
        // 1. Charger l'allocation avec POS et type de ticket
        const { data: allocData, error: allocError } = await supabase
          .from('ticket_allocations')
          .select('*, pos:points_of_sale(*), ticket_type:ticket_types(*)')
          .eq('id', allocationId)
          .single();

        if (allocError || !allocData) {
          console.warn('[AllocationDetailPage] Erreur client Supabase, fallback API:', allocError);
          const res = await fetch(`/api/allocations/${allocationId}`);
          if (!res.ok) {
            setNotFound(true);
            setLoading(false);
            return;
          }
          const apiData = await res.json();
          setAllocation(apiData);
          setLoading(false);
          return;
        }

        // 2. Charger le profil de l'utilisateur qui a alloué
        let allocateurProfile: Profile | null = null;
        if (allocData.alloue_par) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', allocData.alloue_par)
            .single();
          allocateurProfile = prof || null;
        }

        // 3. Charger le groupe d'échange si présent
        let exchangeOps: TicketAllocation[] = [];
        if (allocData.exchange_group_id) {
          const { data: ops } = await supabase
            .from('ticket_allocations')
            .select('*, ticket_type:ticket_types(*)')
            .eq('exchange_group_id', allocData.exchange_group_id);
          exchangeOps = ops || [];
        }

        setAllocation({
          ...(allocData as TicketAllocation),
          allocateur: allocateurProfile,
          exchangeOperations: exchangeOps,
        });
      } catch (err) {
        console.error('[AllocationDetailPage] Exception chargement:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    loadDetail();
  }, [allocationId, supabase, reloadKey]);

  if (loading) {
    return (
      <div className="py-10 flex flex-col items-center gap-3 text-muted text-sm">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
        <span>Chargement de l&apos;allocation...</span>
      </div>
    );
  }

  if (notFound || !allocation) {
    return (
      <Card className="text-center space-y-3 max-w-md mx-auto py-8">
        <div className="w-14 h-14 rounded-xl bg-danger-soft text-danger flex items-center justify-center mx-auto">
          <ArrowLeftRight className="w-7 h-7" />
        </div>
        <h3 className="text-base font-semibold text-foreground">
          Allocation introuvable
        </h3>
        <p className="text-xs text-muted">
          Cette opération d&apos;allocation n&apos;existe pas ou vous n&apos;y avez pas accès.
        </p>
        <Button variant="secondary" onClick={() => router.push('/allocations')}>
          <ArrowLeft className="w-4 h-4" /> Retour aux allocations
        </Button>
      </Card>
    );
  }

  const isReturn = allocation.type === 'exchange_return';
  const isReceive = allocation.type === 'exchange_receive';
  const unitPrice = allocation.ticket_type?.prix || 0;
  const totalValue = allocation.quantite * unitPrice;

  const typeConfig = isReturn
    ? { label: 'Rendu (Échange)', variant: 'danger' as const, color: 'text-danger', Icon: ArrowDownRight }
    : isReceive
    ? { label: 'Reçu (Échange)', variant: 'success' as const, color: 'text-success-soft-foreground', Icon: ArrowUpRight }
    : { label: 'Allocation / Réassort', variant: 'info' as const, color: 'text-accent', Icon: Ticket };

  const TypeIcon = typeConfig.Icon;

  return (
    <div className="space-y-5">
      {/* ── Back nav + Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <Link
            href="/allocations"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-accent transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Retour aux allocations
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 sm:w-6 sm:h-6 text-muted" />
            Détail de l&apos;allocation
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Référence : <span className="font-mono text-foreground">{allocation.id}</span>
          </p>
        </div>
        <Badge variant={typeConfig.variant} className="self-start sm:self-auto text-sm px-3 py-1 gap-1.5 font-semibold">
          <TypeIcon className="w-3.5 h-3.5" />
          {typeConfig.label}
        </Badge>
      </div>

      {/* ── Corriger / supprimer une allocation (pas un échange) ── */}
      {(!allocation.type || allocation.type === 'allocation') && (
        <RecordChangeActions
          type="allocation"
          id={allocation.id}
          values={{
            quantite: Number(allocation.quantite) || 0,
            date_allocation: String(allocation.date_allocation || allocation.created_at || '').slice(0, 10),
            notes: allocation.notes || '',
          }}
          onUpdated={() => setReloadKey((k) => k + 1)}
          onDeleted={() => router.push('/allocations')}
        />
      )}

      {/* ── Summary Card: Acteurs & Horodatages ── */}
      <Card className="border-border space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Point de vente */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0">
              <Store className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted">Point de vente</p>
              <p className="text-sm font-semibold text-foreground mt-0.5 truncate">
                {allocation.pos?.nom || '—'}
              </p>
              {allocation.pos?.ville && (
                <p className="text-xs text-muted truncate">{allocation.pos.ville}</p>
              )}
            </div>
          </div>

          {/* Alloué par */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-default flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-muted" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted">Alloué par</p>
              <p className="text-sm font-semibold text-foreground mt-0.5 truncate">
                {allocation.allocateur?.nom || 'Système'}
              </p>
              {allocation.allocateur?.email && (
                <p className="text-xs text-muted truncate">{allocation.allocateur.email}</p>
              )}
            </div>
          </div>

          {/* Date d'allocation */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-default flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-muted" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted">Date d&apos;opération</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {formatDateOnlyFR(allocation.date_allocation || allocation.created_at)}
              </p>
            </div>
          </div>

          {/* Enregistré dans le système (bonne heure) */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted">Enregistré dans le système</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {formatDateFR(allocation.created_at)}
              </p>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-border" />

        {/* Chiffres de l'allocation : mêmes cadres que le reste de l'application */}
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            label="Ticket"
            value={allocation.ticket_type?.nom || `Type ${allocation.ticket_type_id.slice(0, 8)}`}
            icon={Tag}
            accent="indigo"
            hint={allocation.ticket_type?.duree_heures ? formatTicketDuration(allocation.ticket_type.duree_heures) : undefined}
          />
          <StatTile
            label="Quantité"
            value={isReturn ? `-${formatNumber(allocation.quantite)}` : `+${formatNumber(allocation.quantite)}`}
            icon={Layers}
            accent={isReturn ? 'red' : 'emerald'}
            hint={isReturn ? 'tickets rendus' : 'tickets confiés'}
          />
          <StatTile label="Prix unitaire" value={formatAmountShort(unitPrice)} icon={DollarSign} accent="blue" hint="par ticket" />
          <StatTile
            label="Valeur totale"
            value={`${isReturn ? '-' : '+'}${formatAmountShort(totalValue)}`}
            icon={CheckCircle2}
            accent={isReturn ? 'red' : 'emerald'}
            hint="valeur marchande"
            sensitive
          />
        </div>

        {/* Notes */}
        {allocation.notes && (
          <>
            <div className="border-t border-border" />
            <div className="flex items-start gap-2.5">
              <FileText className="w-4 h-4 text-muted mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-muted mb-1">Notes &amp; Justificatif</p>
                <p className="text-sm text-foreground italic">
                  &laquo; {allocation.notes} &raquo;
                </p>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* ── Si échange groupé : afficher l'ensemble des opérations d'échange ── */}
      {allocation.exchange_group_id && allocation.exchangeOperations && allocation.exchangeOperations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Repeat className="w-4 h-4 text-warning-soft-foreground" />
            Opérations associées à cet échange
            <span className="text-xs font-semibold bg-warning-soft text-warning-soft-foreground px-2 py-0.5 rounded-full">
              Groupe {allocation.exchange_group_id.slice(0, 8)}
            </span>
          </h2>

          <Card className="p-0 overflow-hidden border-border">
            <ResponsiveTable>
            <table className="w-full text-left text-xs">
              <thead className="bg-default text-muted font-semibold">
                <tr>
                  <th className="px-4 py-3">Nature</th>
                  <th className="px-4 py-3">Type de Ticket</th>
                  <th className="px-4 py-3 text-right">Quantité</th>
                  <th className="px-4 py-3 text-right">Prix Unitaire</th>
                  <th className="px-4 py-3 text-right">Valeur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-separator font-medium">
                {allocation.exchangeOperations.map((op) => {
                  const opIsReturn = op.type === 'exchange_return';
                  const opPrice = op.ticket_type?.prix || 0;
                  const isCurrent = op.id === allocation.id;
                  return (
                    <tr
                      key={op.id}
                      className={`transition ${
                        isCurrent
                          ? 'bg-warning-soft font-semibold'
                          : 'hover:bg-surface-secondary '
                      }`}
          >
                      <td className="px-4 py-3">
                        <Badge variant={opIsReturn ? 'danger' : 'success'}>
                          {opIsReturn ? 'Rendu' : 'Reçu'}
                          {isCurrent ? ' (Courant)' : ''}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {op.ticket_type?.nom || `Type ${op.ticket_type_id.slice(0, 8)}`}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold ${
                          opIsReturn ? 'text-danger ' : 'text-success-soft-foreground '
                        }`}
          >
                        {opIsReturn ? `-${op.quantite}` : `+${op.quantite}`}
                      </td>
                      <td className="px-4 py-3 text-right text-muted">
                        {formatCurrencyFCFA(opPrice)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">
                        {formatCurrencyFCFA(op.quantite * opPrice)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </ResponsiveTable>
          </Card>
        </div>
      )}

      {/* ── Traçabilité : qui a fait quoi, quand ── */}
      <RecordHistory type="allocation" id={allocation.id} refreshKey={reloadKey} />
    </div>
  );
}
