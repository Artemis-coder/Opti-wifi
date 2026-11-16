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
  Clock,
  Wallet,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatAmountShort, formatCurrencyFCFA, formatDateFR, formatDateOnlyFR, formatNumber } from '@/lib/utils/format';
import { StatTile } from '@/components/ui/StatTile';
import { KpiGrid } from '@/components/ui/KpiGrid';
import { Collection, CollectionItem } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { RecordChangeActions } from '@/components/records/RecordChangeActions';
import { RecordHistory } from '@/components/records/RecordHistory';

export default function CollectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [notFound, setNotFound] = useState(false);
  // Rechargée après une correction appliquée
  const [reloadKey, setReloadKey] = useState(0);
  const supabase = createClient();

  const collectionId = typeof params?.id === 'string'
    ? params.id
    : Array.isArray(params?.id)
    ? params.id[0]
    : '';

  useEffect(() => {
    if (!collectionId) return;

    async function loadDetail() {
      setLoading(true);
      setNotFound(false);

      try {
        // 1. Charger la collecte avec son POS et son collecteur
        const { data: colData, error: colError } = await supabase
          .from('collections')
          .select('*, pos:points_of_sale(*), collecteur:profiles(*)')
          .eq('id', collectionId)
          .single();

        if (colError || !colData) {
          console.warn('[CollectionDetailPage] Erreur client Supabase, tentative API route:', colError);
          // Fallback vers l'API route
          const res = await fetch(`/api/collections/${collectionId}`);
          if (!res.ok) {
            setNotFound(true);
            setLoading(false);
            return;
          }
          const data = await res.json();
          setCollection(data);
          setLoading(false);
          return;
        }

        // 2. Charger les items de la collecte avec leur type de ticket
        const { data: itemsData, error: itemsError } = await supabase
          .from('collection_items')
          .select('*, ticket_type:ticket_types(*)')
          .eq('collection_id', collectionId);

        if (itemsError) {
          console.warn('[CollectionDetailPage] Erreur items:', itemsError);
        }

        setCollection({
          ...(colData as Collection),
          items: (itemsData as CollectionItem[]) || [],
        });
      } catch (err) {
        console.error('[CollectionDetailPage] Exception au chargement:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    loadDetail();
  }, [collectionId, supabase, reloadKey]);

  /* ── helpers ── */
  const statusConfig = {
    validee: { label: 'Validée', variant: 'success' as const, Icon: CheckCircle2, color: 'text-success-soft-foreground' },
    annulee: { label: 'Annulée', variant: 'danger' as const, Icon: XCircle, color: 'text-danger' },
    brouillon: { label: 'Brouillon', variant: 'warning' as const, Icon: FileText, color: 'text-warning-soft-foreground' },
  };

  const diffIsNeg = collection ? Number(collection.difference) < 0 : false;
  const diffIsZero = collection ? Number(collection.difference) === 0 : false;

  /* ── render states ── */
  if (loading) {
    return (
      <div className="py-10 flex flex-col items-center gap-3 text-muted text-sm">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
        <span>Chargement de l&apos;encaissement...</span>
      </div>
    );
  }

  if (notFound || !collection) {
    return (
      <Card className="text-center space-y-3 max-w-md mx-auto py-8">
        <div className="w-14 h-14 rounded-xl bg-danger-soft text-danger flex items-center justify-center mx-auto">
          <Receipt className="w-7 h-7" />
        </div>
        <h3 className="text-base font-semibold text-foreground">
          Encaissement introuvable
        </h3>
        <p className="text-xs text-muted">
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

  const montantCollecte = Number(collection.montant_collecte || 0);
  const montantAttendu = Number(collection.montant_attendu || 0);
  const commission = Number(collection.commission || 0);
  const montantRestant = montantCollecte - commission;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* ── Back nav + Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <Link
            href="/collections"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-accent transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Retour aux encaissements
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-muted" />
            Détail de l&apos;encaissement
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Référence : <span className="font-mono text-foreground">{collection.id}</span>
          </p>
        </div>
        <Badge variant={status.variant} className="self-start sm:self-auto text-sm px-3 py-1 gap-1.5">
          <StatusIcon className="w-3.5 h-3.5" />
          {status.label}
        </Badge>
      </div>

      {/* ── Corriger / supprimer (administrateur : direct ; collecteur : demande à valider) ── */}
      <RecordChangeActions
        type="collection"
        id={collection.id}
        values={{
          montant_collecte: Number(collection.montant_collecte) || 0,
          commission: Number(collection.commission) || 0,
          date_collecte: String(collection.date_collecte || collection.created_at || '').slice(0, 10),
          notes: collection.notes || '',
        }}
        onUpdated={() => setReloadKey((k) => k + 1)}
        onDeleted={() => router.push('/collections')}
      />

      {/* ── Summary Card ── */}
      <Card className="border-border space-y-4">
        {/* POS + Collecteur + Date d'opération + Enregistrement Système */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted">Point de vente</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {collection.pos?.nom || '—'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-default flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-muted" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted">Collecteur</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {collection.collecteur?.nom || '—'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-default flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-muted" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted">Date de collecte</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {formatDateOnlyFR(collection.date_collecte || collection.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted">Enregistré dans le système</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {formatDateFR(collection.created_at)}
              </p>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-border" />

        {/* Chiffres de l'encaissement : la dernière ligne occupe toujours toute la largeur */}
        <KpiGrid cols={{ base: 2, sm: 3 }}>
          <StatTile label="Attendu" value={formatAmountShort(montantAttendu)} icon={DollarSign} accent="indigo" hint="D’après les tickets vendus" />
          <StatTile label="Total encaissé" value={formatAmountShort(montantCollecte)} icon={Receipt} accent="emerald" />
          <StatTile label="Commission" value={formatAmountShort(commission)} icon={ShoppingBag} accent="amber" hint="Versée au point de vente" />
          <StatTile label="Net restant" value={formatAmountShort(montantRestant)} icon={Wallet} accent="blue" hint="Après commission" />
          <StatTile
            label="Écart"
            value={diffIsZero ? formatAmountShort(0) : `${diffIsNeg ? '' : '+'}${formatAmountShort(Number(collection.difference))}`}
            icon={diffIsNeg ? AlertTriangle : CheckCircle2}
            accent={diffIsNeg ? 'red' : 'emerald'}
            alert={diffIsNeg}
            hint={diffIsZero ? 'Aucun écart' : diffIsNeg ? 'Manque à encaisser' : 'Excédent de caisse'}
            sensitive
          />
        </KpiGrid>

        {/* Notes */}
        {collection.notes && (
          <>
            <div className="border-t border-border" />
            <div className="flex items-start gap-2.5">
              <FileText className="w-4 h-4 text-muted mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-muted mb-1">Notes</p>
                <p className="text-sm text-foreground italic">
                  &laquo; {collection.notes} &raquo;
                </p>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* ── Items Table ── */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-2.5 flex items-center gap-2">
          <Package className="w-4 h-4 text-accent" />
          Détail des tickets encaissés
          {hasItems && (
            <span className="text-xs font-semibold bg-default text-muted px-2 py-0.5 rounded-full">
              {collection.items!.length} ligne{collection.items!.length > 1 ? 's' : ''}
            </span>
          )}
        </h2>

        {!hasItems ? (
          <Card className="text-center space-y-2 py-8">
            <Package className="w-8 h-8 text-muted mx-auto" />
            <p className="text-sm font-semibold text-muted">
              Aucun item de ticket enregistré pour cette collecte.
            </p>
          </Card>
        ) : (
          <Card className="p-0 overflow-hidden border-border">
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-default text-muted font-semibold">
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
                <tbody className="divide-y divide-separator font-medium">
                  {collection.items!.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-secondary transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0">
                            <Package className="w-3.5 h-3.5" />
                          </div>
                          <span className="font-semibold text-foreground">
                            {item.ticket_type?.nom || `Type ${item.ticket_type_id.slice(0, 8)}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-muted">
                        {formatNumber(item.stock_debut)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">
                        {formatNumber(item.quantite_vendue)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted">
                        {formatCurrencyFCFA(item.prix_unitaire)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-success-soft-foreground">
                        {formatCurrencyFCFA(item.montant_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-surface-secondary text-xs font-semibold">
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-muted text-right">
                      Total brut encaissé
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-foreground">
                      {formatCurrencyFCFA(montantCollecte)}
                    </td>
                  </tr>
                  {commission > 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-warning-soft-foreground text-right">
                        Commission POS déduite
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-warning-soft-foreground">
                        - {formatCurrencyFCFA(commission)}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-accent-soft">
                    <td colSpan={4} className="px-4 py-3 font-semibold text-accent text-right">
                      Montant net restant après commission
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-accent">
                      {formatCurrencyFCFA(montantRestant)}
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
                  className="p-3 rounded-xl border border-border bg-surface space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0">
                      <Package className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {item.ticket_type?.nom || `Type ${item.ticket_type_id.slice(0, 8)}`}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-surface-secondary">
                      <p className="text-[9px] font-semibold text-muted">Stock début</p>
                      <p className="text-xs font-semibold text-foreground mt-0.5">
                        {formatNumber(item.stock_debut)}
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-surface-secondary">
                      <p className="text-[9px] font-semibold text-muted">Qté vendue</p>
                      <p className="text-xs font-semibold text-foreground mt-0.5">
                        {formatNumber(item.quantite_vendue)}
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-surface-secondary">
                      <p className="text-[9px] font-semibold text-muted">Prix unit.</p>
                      <p className="text-xs font-semibold text-foreground mt-0.5">
                        {formatCurrencyFCFA(item.prix_unitaire)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1.5 border-t border-separator">
                    <span className="text-xs font-semibold text-muted">Montant total</span>
                    <span className="text-sm font-semibold text-success-soft-foreground">
                      {formatCurrencyFCFA(item.montant_total)}
                    </span>
                  </div>
                </div>
              ))}

              {/* Mobile financial summary */}
              <div className="p-3 rounded-xl bg-surface-secondary space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted font-medium">Total brut collecté</span>
                  <span className="font-semibold text-foreground">
                    {formatCurrencyFCFA(montantCollecte)}
                  </span>
                </div>
                {commission > 0 && (
                  <div className="flex items-center justify-between text-warning-soft-foreground">
                    <span className="font-medium">Commission POS</span>
                    <span className="font-semibold">- {formatCurrencyFCFA(commission)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="font-semibold text-accent">
                    Net restant après commission
                  </span>
                  <span className="text-base font-semibold text-accent">
                    {formatCurrencyFCFA(montantRestant)}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* ── Traçabilité : qui a fait quoi, quand ── */}
      <RecordHistory type="collection" id={collection.id} refreshKey={reloadKey} />
    </div>
  );
}
