'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Receipt,
  ArrowLeft,
  Loader2,
  Store,
  User,
  Calendar,
  FileText,
  Package,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Hash,
  DollarSign,
  ShoppingBag,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatCurrencyFCFA, formatDateFR, formatNumber } from '@/lib/utils/format';
import { Collection } from '@/types/database';

export default function CollectionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!params?.id) return;
    async function loadDetail() {
      setLoading(true);
      const res = await fetch(`/api/collections/${params.id}`);
      if (!res.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setCollection(data);
      setLoading(false);
    }
    loadDetail();
  }, [params?.id]);

  /* ── helpers ── */
  const statusConfig = {
    validee: { label: 'Validée', variant: 'success' as const, Icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400' },
    annulee: { label: 'Annulée', variant: 'danger' as const, Icon: XCircle, color: 'text-red-600 dark:text-red-400' },
    brouillon: { label: 'Brouillon', variant: 'warning' as const, Icon: FileText, color: 'text-amber-600 dark:text-amber-400' },
  };

  const diffIsNeg = collection ? Number(collection.difference) < 0 : false;
  const diffIsZero = collection ? Number(collection.difference) === 0 : false;

  /* ── render states ── */
  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center gap-3 text-slate-500 text-sm">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
        <span>Chargement de l&apos;encaissement...</span>
      </div>
    );
  }

  if (notFound || !collection) {
    return (
      <Card className="p-10 text-center space-y-3 max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
          <Receipt className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Encaissement introuvable
        </h3>
        <p className="text-xs text-slate-500">
          Cet encaissement n&apos;existe pas ou vous n&apos;y avez pas accès.
        </p>
        <Button variant="secondary" onClick={() => router.push('/collections')} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Retour à la liste
        </Button>
      </Card>
    );
  }

  const status = statusConfig[collection.statut] ?? statusConfig.brouillon;
  const StatusIcon = status.Icon;
  const hasItems = Array.isArray(collection.items) && collection.items.length > 0;
  const displayDate = collection.date_collecte
    ? formatDateFR(collection.date_collecte)
    : formatDateFR(collection.created_at);

  return (
    <div className="space-y-5 max-w-3xl mx-auto pb-10">
      {/* ── Back nav + Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <Link
            href="/collections"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Retour aux encaissements
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-brand-600 dark:text-brand-400" />
            Détail de l&apos;encaissement
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Référence : <span className="font-mono text-slate-700 dark:text-slate-300">{collection.id}</span>
          </p>
        </div>
        <Badge variant={status.variant} className="self-start sm:self-auto text-sm px-3 py-1 gap-1.5">
          <StatusIcon className="w-3.5 h-3.5" />
          {status.label}
        </Badge>
      </div>

      {/* ── Summary Card ── */}
      <Card className="p-4 sm:p-6 border-slate-200 dark:border-slate-800 space-y-4">
        {/* POS + Collecteur + Date */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 border border-brand-500/20">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Point de vente</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                {collection.pos?.nom || '—'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Collecteur</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                {collection.collecteur?.nom || '—'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Date de collecte</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{displayDate}</p>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-slate-200 dark:border-slate-800" />

        {/* Financial KPIs row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Montant Attendu */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              <DollarSign className="w-3 h-3 text-blue-500 shrink-0" />
              Attendu
            </div>
            <p className="text-base font-extrabold text-slate-700 dark:text-slate-200 truncate">
              {formatCurrencyFCFA(Number(collection.montant_attendu))}
            </p>
          </div>

          {/* Montant Encaissé */}
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-500 mb-1">
              <Receipt className="w-3 h-3 shrink-0" />
              Encaissé
            </div>
            <p className="text-base font-extrabold text-emerald-700 dark:text-emerald-300 truncate">
              {formatCurrencyFCFA(Number(collection.montant_collecte))}
            </p>
          </div>

          {/* Commission */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              <ShoppingBag className="w-3 h-3 shrink-0" />
              Commission
            </div>
            <p className="text-base font-extrabold text-slate-700 dark:text-slate-200 truncate">
              {formatCurrencyFCFA(Number(collection.commission || 0))}
            </p>
          </div>

          {/* Écart */}
          <div
            className={`p-3 rounded-xl border ${
              diffIsZero
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/60 dark:border-emerald-800/40'
                : diffIsNeg
                ? 'bg-red-50 dark:bg-red-950/30 border-red-200/60 dark:border-red-800/40'
                : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/60 dark:border-emerald-800/40'
            }`}
          >
            <div
              className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider mb-1 ${
                diffIsNeg ? 'text-red-500' : 'text-emerald-500'
              }`}
            >
              {diffIsNeg ? (
                <AlertTriangle className="w-3 h-3 shrink-0" />
              ) : (
                <CheckCircle2 className="w-3 h-3 shrink-0" />
              )}
              Écart
            </div>
            <p
              className={`text-base font-extrabold truncate ${
                diffIsZero
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : diffIsNeg
                  ? 'text-red-700 dark:text-red-300'
                  : 'text-emerald-700 dark:text-emerald-300'
              }`}
            >
              {diffIsZero
                ? '0 FCFA'
                : `${diffIsNeg ? '' : '+'}${formatCurrencyFCFA(Number(collection.difference))}`}
            </p>
          </div>
        </div>

        {/* Notes */}
        {collection.notes && (
          <>
            <div className="border-t border-slate-200 dark:border-slate-800" />
            <div className="flex items-start gap-2.5">
              <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1">Notes</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 italic">
                  &laquo; {collection.notes} &raquo;
                </p>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* ── Items Table ── */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5 flex items-center gap-2">
          <Package className="w-4 h-4 text-brand-500" />
          Détail des tickets encaissés
          {hasItems && (
            <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">
              {collection.items!.length} ligne{collection.items!.length > 1 ? 's' : ''}
            </span>
          )}
        </h2>

        {!hasItems ? (
          <Card className="p-8 text-center space-y-2">
            <Package className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-500">
              Aucun item de ticket enregistré pour cette collecte.
            </p>
          </Card>
        ) : (
          <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800">
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 flex items-center gap-1.5">
                      <Hash className="w-3 h-3" /> Type de ticket
                    </th>
                    <th className="px-4 py-3 text-right">Stock début</th>
                    <th className="px-4 py-3 text-right">Qté vendue</th>
                    <th className="px-4 py-3 text-right">Prix unit.</th>
                    <th className="px-4 py-3 text-right">Montant total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                  {collection.items!.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                            <Package className="w-3.5 h-3.5" />
                          </div>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {item.ticket_type?.nom || `Type ${item.ticket_type_id.slice(0, 8)}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                        {formatNumber(item.stock_debut)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                        {formatNumber(item.quantite_vendue)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                        {formatCurrencyFCFA(item.prix_unitaire)}
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                        {formatCurrencyFCFA(item.montant_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-700">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-400 text-right">
                      Total encaissé
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                      {formatCurrencyFCFA(Number(collection.montant_collecte))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="sm:hidden p-3 space-y-2.5">
              {collection.items!.map((item) => (
                <div
                  key={`mob-${item.id}`}
                  className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                      <Package className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {item.ticket_type?.nom || `Type ${item.ticket_type_id.slice(0, 8)}`}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                      <p className="text-[9px] uppercase tracking-wider font-semibold text-slate-400">Stock début</p>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">
                        {formatNumber(item.stock_debut)}
                      </p>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                      <p className="text-[9px] uppercase tracking-wider font-semibold text-slate-400">Qté vendue</p>
                      <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                        {formatNumber(item.quantite_vendue)}
                      </p>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                      <p className="text-[9px] uppercase tracking-wider font-semibold text-slate-400">Prix unit.</p>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">
                        {formatCurrencyFCFA(item.prix_unitaire)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Montant total</span>
                    <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                      {formatCurrencyFCFA(item.montant_total)}
                    </span>
                  </div>
                </div>
              ))}

              {/* Mobile total */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                  Total encaissé
                </span>
                <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">
                  {formatCurrencyFCFA(Number(collection.montant_collecte))}
                </span>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
