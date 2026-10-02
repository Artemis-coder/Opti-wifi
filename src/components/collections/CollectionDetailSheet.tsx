'use client';

import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Store,
  Ticket,
  User,
  Wallet,
  PiggyBank,
  Receipt,
  Scale,
  StickyNote,
  TrendingUp,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { useCollectionDetail } from '@/hooks/useCollectionDetail';
import { formatCurrencyFCFA, formatDateOnlyFR, formatNumber } from '@/lib/utils/format';
import { Collection } from '@/types/database';
import { cn } from '@/lib/utils/cn';

interface CollectionDetailSheetProps {
  collection: Collection | null;
  onClose: () => void;
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  tone?: 'neutral' | 'good' | 'bad';
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-3',
        tone === 'good' && 'border-emerald-200 bg-emerald-50',
        tone === 'bad' && 'border-red-200 bg-red-50',
        tone === 'neutral' && 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40'
      )}
    >
      <div className="flex items-center gap-1.5 text-slate-500">
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-wider truncate">{label}</span>
      </div>
      <p
        className={cn(
          'mt-1 text-sm font-bold truncate',
          tone === 'good' && 'text-emerald-700',
          tone === 'bad' && 'text-red-700',
          tone === 'neutral' && 'text-slate-900 dark:text-white'
        )}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * Full breakdown of a cash collection: header, reconciliation figures and the
 * per-ticket-type lines. Rendered as a Material 3 bottom sheet on phones and
 * as a dialog from sm upwards.
 */
export function CollectionDetailSheet({ collection, onClose }: CollectionDetailSheetProps) {
  const { items, totals, loading, error } = useCollectionDetail(collection);

  if (!collection) return null;

  const attendu = Number(collection.montant_attendu ?? 0);
  const collecte = Number(collection.montant_collecte ?? 0);
  const difference = Number(collection.difference ?? 0);
  const commission = Number(collection.commission ?? 0);
  const isConform = difference === 0;
  const date = collection.date_collecte || collection.created_at;

  return (
    <Modal
      isOpen={!!collection}
      onClose={onClose}
      title={`Encaissement du ${formatDateOnlyFR(date)}`}
    >
      {/* Contexte */}
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <Store className="mt-0.5 w-4 h-4 shrink-0 text-slate-400" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-slate-500">Point de vente</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {collection.pos?.nom || 'Point de vente'}
            </p>
            {collection.pos?.ville && (
              <p className="text-[11px] text-slate-500 truncate">{collection.pos.ville}</p>
            )}
          </div>
          <Badge variant={collection.statut === 'validee' ? 'success' : 'warning'}>
            {collection.statut === 'validee' ? 'Validée' : collection.statut}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <User className="w-4 h-4 shrink-0 text-slate-400" />
          <p className="min-w-0 flex-1 text-[13px] text-slate-600 dark:text-slate-400 truncate">
            Collecté par {collection.collecteur?.nom || 'Collecteur'}
          </p>
        </div>
      </div>

      {/* Chiffres clés */}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <Kpi icon={Scale} label="Montant attendu" value={formatCurrencyFCFA(attendu)} />
        <Kpi
          icon={Wallet}
          label="Montant encaissé"
          value={formatCurrencyFCFA(collecte)}
          tone="good"
        />
        <Kpi
          icon={AlertTriangle}
          label="Écart"
          value={formatCurrencyFCFA(difference)}
          tone={isConform ? 'good' : 'bad'}
        />
        <Kpi icon={PiggyBank} label="Commission POS" value={formatCurrencyFCFA(commission)} />
      </div>

      {/* Conciliation */}
      <div
        className={cn(
          'mt-3 flex items-center gap-2.5 rounded-2xl border p-3',
          isConform
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-red-200 bg-red-50 text-red-800'
        )}
      >
        {isConform ? (
          <CheckCircle2 className="w-5 h-5 shrink-0" />
        ) : (
          <AlertTriangle className="w-5 h-5 shrink-0" />
        )}
        <p className="text-[13px] font-semibold">
          {isConform
            ? 'Caisse conforme : le compté correspond au théorique'
            : `Écart de ${formatCurrencyFCFA(Math.abs(difference))} ${difference < 0 ? 'manquant' : 'en trop'}`}
        </p>
      </div>

      {/* Détail par type de ticket */}
      <section className="mt-5">
        <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <Ticket className="w-3.5 h-3.5" />
          Détail par type de ticket
        </h4>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
            Chargement du détail...
          </div>
        ) : error ? (
          <p className="mt-2 rounded-xl bg-red-50 p-3 text-[13px] text-red-700">{error}</p>
        ) : items.length === 0 ? (
          <p className="mt-2 rounded-xl bg-slate-50 p-3 text-[13px] text-slate-500 dark:bg-slate-800/50">
            Aucune ligne de vente enregistrée pour cet encaissement.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {items.map((item) => {
              const remaining = Number(item.stock_debut ?? 0) - Number(item.quantite_vendue ?? 0);
              return (
                <li key={item.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">
                      {item.ticket_type?.nom || 'Type de ticket'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {formatNumber(item.quantite_vendue)} ×{' '}
                      {formatCurrencyFCFA(item.prix_unitaire)}
                      {remaining > 0 && ` · ${formatNumber(remaining)} restant(s)`}
                    </p>
                  </div>
                  <p className="shrink-0 text-[13px] font-bold text-slate-900 dark:text-white">
                    {formatCurrencyFCFA(item.montant_total)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Totaux */}
      {totals && items.length > 0 && !loading && (
        <section className="mt-5">
          <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <Receipt className="w-3.5 h-3.5" />
            Récapitulatif
          </h4>
          <dl className="mt-2 space-y-1.5 rounded-2xl border border-slate-200 p-3 text-[13px] dark:border-slate-800">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Tickets vendus</dt>
              <dd className="font-semibold text-slate-900 dark:text-white">
                {formatNumber(totals.ticketsSold)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Panier moyen par ticket</dt>
              <dd className="font-semibold text-slate-900 dark:text-white">
                {formatCurrencyFCFA(totals.averageBasket)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Net après commission</dt>
              <dd className="font-semibold text-slate-900 dark:text-white">
                {formatCurrencyFCFA(totals.netCollected)}
              </dd>
            </div>
            {commission > 0 && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Taux de commission</dt>
                <dd className="flex items-center gap-1 font-semibold text-slate-900 dark:text-white">
                  <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                  {totals.commissionRate.toFixed(1)} %
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-1.5 dark:border-slate-800">
              <dt className="text-slate-500">Total du détail</dt>
              <dd className="font-semibold text-slate-900 dark:text-white">
                {formatCurrencyFCFA(totals.detailTotal)}
              </dd>
            </div>
          </dl>

          {!totals.detailMatchesExpected && (
            <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-[12px] text-amber-800">
              <AlertTriangle className="mt-0.5 w-3.5 h-3.5 shrink-0" />
              Le total des lignes ({formatCurrencyFCFA(totals.detailTotal)}) ne correspond
              pas au montant attendu ({formatCurrencyFCFA(attendu)}).
            </p>
          )}

          {totals.overstockItems.length > 0 && (
            <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-[12px] text-amber-800">
              <AlertTriangle className="mt-0.5 w-3.5 h-3.5 shrink-0" />
              {totals.overstockItems.length} type(s) de ticket ont une quantité vendue
              supérieure au stock de début enregistré.
            </p>
          )}
        </section>
      )}

      {/* Observations */}
      {collection.notes && (
        <section className="mt-5">
          <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <StickyNote className="w-3.5 h-3.5" />
            Observations
          </h4>
          <p className="mt-2 whitespace-pre-line rounded-2xl bg-slate-50 p-3 text-[13px] text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
            {collection.notes}
          </p>
        </section>
      )}
    </Modal>
  );
}
