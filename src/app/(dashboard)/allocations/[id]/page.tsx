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
import { formatCurrencyFCFA, formatDateFR, formatDateOnlyFR, formatNumber } from '@/lib/utils/format';
import { TicketAllocation, PointOfSale, TicketType, Profile } from '@/types/database';
import { createClient } from '@/lib/supabase/client';

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
  }, [allocationId, supabase]);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center gap-3 text-slate-500 text-sm">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
        <span>Chargement de l&apos;allocation...</span>
      </div>
    );
  }

  if (notFound || !allocation) {
    return (
      <Card className="p-10 text-center space-y-3 max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
          <ArrowLeftRight className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Allocation introuvable
        </h3>
        <p className="text-xs text-slate-500">
          Cette opération d&apos;allocation n&apos;existe pas ou vous n&apos;y avez pas accès.
        </p>
        <Button variant="secondary" onClick={() => router.push('/allocations')} className="gap-2">
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
    ? { label: 'Rendu (Échange)', variant: 'danger' as const, color: 'text-red-600', Icon: ArrowDownRight }
    : isReceive
    ? { label: 'Reçu (Échange)', variant: 'success' as const, color: 'text-emerald-600', Icon: ArrowUpRight }
    : { label: 'Allocation / Réassort', variant: 'info' as const, color: 'text-brand-600', Icon: Ticket };

  const TypeIcon = typeConfig.Icon;

  return (
    <div className="space-y-5 max-w-3xl mx-auto pb-10">
      {/* ── Back nav + Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <Link
            href="/allocations"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Retour aux allocations
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 sm:w-6 sm:h-6 text-brand-600 dark:text-brand-400" />
            Détail de l&apos;allocation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Référence : <span className="font-mono text-slate-700 dark:text-slate-300">{allocation.id}</span>
          </p>
        </div>
        <Badge variant={typeConfig.variant} className="self-start sm:self-auto text-sm px-3 py-1 gap-1.5 font-bold">
          <TypeIcon className="w-3.5 h-3.5" />
          {typeConfig.label}
        </Badge>
      </div>

      {/* ── Summary Card: Acteurs & Horodatages ── */}
      <Card className="p-4 sm:p-6 border-slate-200 dark:border-slate-800 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Point de vente */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 border border-brand-500/20">
              <Store className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Point de vente</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                {allocation.pos?.nom || '—'}
              </p>
              {allocation.pos?.ville && (
                <p className="text-[11px] text-slate-500 truncate">{allocation.pos.ville}</p>
              )}
            </div>
          </div>

          {/* Alloué par */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Alloué par</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                {allocation.allocateur?.nom || 'Système'}
              </p>
              {allocation.allocateur?.email && (
                <p className="text-[11px] text-slate-500 truncate">{allocation.allocateur.email}</p>
              )}
            </div>
          </div>

          {/* Date d'allocation */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Date d&apos;opération</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                {formatDateOnlyFR(allocation.date_allocation || allocation.created_at)}
              </p>
            </div>
          </div>

          {/* Enregistré dans le système (bonne heure) */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Enregistré dans le système</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                {formatDateFR(allocation.created_at)}
              </p>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-slate-200 dark:border-slate-800" />

        {/* Financial & Quantité KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Type de Ticket */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              <Tag className="w-3 h-3 text-brand-500 shrink-0" />
              Ticket
            </div>
            <p className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
              {allocation.ticket_type?.nom || `Type ${allocation.ticket_type_id.slice(0, 8)}`}
            </p>
            {allocation.ticket_type?.duree_heures && (
              <p className="text-[11px] text-slate-500">{allocation.ticket_type.duree_heures}h</p>
            )}
          </div>

          {/* Quantité */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              <Layers className="w-3 h-3 text-emerald-500 shrink-0" />
              Quantité
            </div>
            <p
              className={`text-base sm:text-lg font-extrabold truncate ${
                isReturn ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {isReturn ? `-${formatNumber(allocation.quantite)}` : `+${formatNumber(allocation.quantite)}`}
            </p>
            <p className="text-[11px] text-slate-500">tickets</p>
          </div>

          {/* Prix unitaire */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              <DollarSign className="w-3 h-3 text-blue-500 shrink-0" />
              Prix unitaire
            </div>
            <p className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-slate-200 truncate">
              {formatCurrencyFCFA(unitPrice)}
            </p>
            <p className="text-[11px] text-slate-500">par ticket</p>
          </div>

          {/* Valeur totale */}
          <div
            className={`p-3 rounded-xl border ${
              isReturn
                ? 'bg-red-50 dark:bg-red-950/30 border-red-200/60 dark:border-red-800/40'
                : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/60 dark:border-emerald-800/40'
            }`}
          >
            <div
              className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider mb-1 ${
                isReturn ? 'text-red-500' : 'text-emerald-500'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              Valeur Totale
            </div>
            <p
              className={`text-base sm:text-lg font-extrabold truncate ${
                isReturn ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'
              }`}
            >
              {isReturn ? `-${formatCurrencyFCFA(totalValue)}` : `+${formatCurrencyFCFA(totalValue)}`}
            </p>
            <p className="text-[11px] text-slate-500">valeur marchande</p>
          </div>
        </div>

        {/* Notes */}
        {allocation.notes && (
          <>
            <div className="border-t border-slate-200 dark:border-slate-800" />
            <div className="flex items-start gap-2.5">
              <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1">Notes &amp; Justificatif</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 italic">
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
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Repeat className="w-4 h-4 text-amber-500" />
            Opérations associées à cet échange
            <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
              Groupe {allocation.exchange_group_id.slice(0, 8)}
            </span>
          </h2>

          <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Nature</th>
                  <th className="px-4 py-3">Type de Ticket</th>
                  <th className="px-4 py-3 text-right">Quantité</th>
                  <th className="px-4 py-3 text-right">Prix Unitaire</th>
                  <th className="px-4 py-3 text-right">Valeur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {allocation.exchangeOperations.map((op) => {
                  const opIsReturn = op.type === 'exchange_return';
                  const opPrice = op.ticket_type?.prix || 0;
                  const isCurrent = op.id === allocation.id;
                  return (
                    <tr
                      key={op.id}
                      className={`transition ${
                        isCurrent
                          ? 'bg-amber-50/60 dark:bg-amber-950/20 font-bold'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <Badge variant={opIsReturn ? 'danger' : 'success'}>
                          {opIsReturn ? 'Rendu' : 'Reçu'}
                          {isCurrent ? ' (Courant)' : ''}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-900 dark:text-white">
                        {op.ticket_type?.nom || `Type ${op.ticket_type_id.slice(0, 8)}`}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold ${
                          opIsReturn ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {opIsReturn ? `-${op.quantite}` : `+${op.quantite}`}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                        {formatCurrencyFCFA(opPrice)}
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-slate-900 dark:text-white">
                        {formatCurrencyFCFA(op.quantite * opPrice)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}