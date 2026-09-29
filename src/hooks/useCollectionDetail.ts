'use client';

import React from 'react';
import { createClient } from '@/lib/supabase/client';
import { Collection, CollectionItem } from '@/types/database';

export interface CollectionTotals {
  /** Sum of collection_items.montant_total. */
  detailTotal: number;
  /** Sum of collection_items.quantite_vendue. */
  ticketsSold: number;
  /** Average basket: total collected divided by tickets sold. */
  averageBasket: number;
  /** detailTotal vs the collection's montant_attendu. */
  detailMatchesExpected: boolean;
  /** amount actually handed to the POS as commission. */
  netCollected: number;
  commissionRate: number;
  /** Items sold above the stock recorded at the start of the collection. */
  overstockItems: CollectionItem[];
}

/**
 * Loads the reconciliation lines of a collection and derives the figures the
 * detail view needs. Lines are fetched on demand so opening the sheet stays
 * instant even when the history list is long.
 */
export function useCollectionDetail(collection: Collection | null) {
  const [items, setItems] = React.useState<CollectionItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const collectionId = collection?.id ?? null;
  const supabase = createClient();

  React.useEffect(() => {
    if (!collectionId) return;

    let cancelled = false;

    async function loadItems() {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('collection_items')
        .select('*, ticket_type:ticket_types(*)')
        .eq('collection_id', collectionId)
        .order('montant_total', { ascending: false });

      if (cancelled) return;

      if (queryError) {
        setError('Impossible de charger le détail de cet encaissement');
        setItems([]);
      } else {
        setItems((data ?? []) as CollectionItem[]);
      }
      setLoading(false);
    }

    loadItems();

    return () => {
      cancelled = true;
    };
  }, [collectionId, supabase]);

  // No collection open: nothing to show, and never the previous one's lines.
  const visibleItems = collectionId ? items : [];

  const totals = React.useMemo<CollectionTotals | null>(() => {
    if (!collection) return null;

    const detailTotal = items.reduce((sum, i) => sum + Number(i.montant_total ?? 0), 0);
    const ticketsSold = items.reduce((sum, i) => sum + Number(i.quantite_vendue ?? 0), 0);
    const attendu = Number(collection.montant_attendu ?? 0);
    const commission = Number(collection.commission ?? 0);

    return {
      detailTotal,
      ticketsSold,
      averageBasket: ticketsSold > 0 ? Number(collection.montant_collecte ?? 0) / ticketsSold : 0,
      detailMatchesExpected: Math.abs(detailTotal - attendu) < 1,
      netCollected: Number(collection.montant_collecte ?? 0) - commission,
      commissionRate: attendu > 0 ? (commission / attendu) * 100 : 0,
      overstockItems: items.filter(
        (i) => Number(i.stock_debut ?? 0) > 0 && Number(i.quantite_vendue ?? 0) > Number(i.stock_debut ?? 0)
      ),
    };
  }, [collection, items]);

  return { items: visibleItems, totals, loading, error };
}
