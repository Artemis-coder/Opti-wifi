'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Receipt, Plus, CheckCircle2, AlertTriangle, Loader2, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CollectionDetailSheet } from '@/components/collections/CollectionDetailSheet';
import { formatCurrencyFCFA, formatDateFR } from '@/lib/utils/format';
import { createClient } from '@/lib/supabase/client';
import { useSpaceStore } from '@/lib/stores/spaceStore';
import { useAuthStore } from '@/lib/stores/authStore';
import { Collection } from '@/types/database';

export default function CollectionsPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selected, setSelected] = useState<Collection | null>(null);
  const supabase = createClient();
  const { currentSpaceId } = useSpaceStore();

  useEffect(() => {
    async function loadCollections() {
      if (!user?.organization_id) return;
      setLoading(true);
      let query = supabase
        .from('collections')
        .select('*, pos:points_of_sale(*), collecteur:profiles(*)')
        .eq('organization_id', user.organization_id)
        .order('created_at', { ascending: false });

      if (currentSpaceId) {
        query = query.eq('space_id', currentSpaceId);
      }

      const { data } = await query;
      setCollections(data || []);
      setLoading(false);
    }
    loadCollections();
  }, [currentSpaceId, user?.organization_id, supabase]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Encaissements & Collectes</h1>
          <p className="text-xs text-slate-500">Historique complet de vos levées de caisses.</p>
        </div>
        <Link href="/collections/new">
          <Button variant="secondary" className="gap-2 font-bold">
            <Plus className="w-4 h-4" />
            Nouvelle Collecte de Caisse
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
          Chargement des collectes...
        </div>
      ) : collections.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-brand-500/10 text-brand-500 flex items-center justify-center mx-auto">
            <Receipt className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucun encaissement pour le moment</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
             Vous n&apos;avez enregistré aucune collecte de caisse. Lancez votre première levée de fonds.
          </p>
          <Link href="/collections/new" className="inline-block pt-2">
            <Button variant="secondary" className="font-bold gap-2">
              <Plus className="w-4 h-4" /> Démarrer une collecte
            </Button>
          </Link>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          {/* Mobile card list */}
          <ul className="sm:hidden divide-y divide-slate-200 dark:divide-slate-800">
            {collections.map((c) => (
              <li key={c.id} className="p-4 space-y-2">
                <button
                  type="button"
                  onClick={() => setSelected(c)}
                  aria-label={`Voir le détail de l'encaissement du ${c.pos?.nom || 'POS'}`}
                  className="md-ripple w-full space-y-2 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {c.pos?.nom || 'POS'}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {c.collecteur?.nom || 'Collecteur'} ·{' '}
                        {c.date_collecte ? formatDateFR(c.date_collecte) : formatDateFR(c.created_at)}
                      </p>
                    </div>
                    <Badge variant={c.statut === 'validee' ? 'success' : 'warning'}>
                      {c.statut === 'validee' ? 'Validée' : 'Brouillon'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Attendu</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {formatCurrencyFCFA(c.montant_attendu)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Commission</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {formatCurrencyFCFA(Number(c.commission || 0))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Encaissé</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatCurrencyFCFA(c.montant_collecte)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Écart</span>
                      {c.difference === 0 ? (
                        <span className="font-bold text-emerald-600 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 0
                        </span>
                      ) : (
                        <span className="font-bold text-red-600 inline-flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> {formatCurrencyFCFA(c.difference)}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="flex items-center gap-1 text-[11px] font-semibold text-brand-600">
                    Voir le détail et la conciliation
                    <ChevronRight className="w-3.5 h-3.5" />
                  </p>
                </button>
              </li>
            ))}
          </ul>

          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Point de Vente</th>
                  <th className="px-4 py-3">Collecteur</th>
                  <th className="px-4 py-3">Montant Attendu</th>
                  <th className="px-4 py-3">Montant Encaissé</th>
                  <th className="px-4 py-3">Commission</th>
                  <th className="px-4 py-3">Écart (Diff)</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">
                    <span className="sr-only">Détail</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {collections.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{c.pos?.nom || 'POS'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{c.collecteur?.nom || 'Collecteur'}</td>
                    <td className="px-4 py-3 font-medium text-slate-600">{formatCurrencyFCFA(c.montant_attendu)}</td>
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{formatCurrencyFCFA(c.montant_collecte)}</td>
                    <td className="px-4 py-3 font-medium text-slate-600">{formatCurrencyFCFA(Number(c.commission || 0))}</td>
                    <td className="px-4 py-3">
                      {c.difference === 0 ? (
                        <span className="text-emerald-600 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 0 FCFA
                        </span>
                      ) : (
                        <span className="text-red-600 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> {formatCurrencyFCFA(c.difference)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={c.statut === 'validee' ? 'success' : 'warning'}>
                        {c.statut === 'validee' ? 'Validée' : 'Brouillon'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {c.date_collecte ? formatDateFR(c.date_collecte) : formatDateFR(c.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(c);
                        }}
                        aria-label={`Voir le détail de l'encaissement du ${c.pos?.nom || 'POS'}`}
                        className="md-ripple tap-target inline-flex items-center justify-center rounded-full text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <CollectionDetailSheet collection={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
