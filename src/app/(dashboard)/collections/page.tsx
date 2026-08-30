'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Receipt, Plus, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatCurrencyFCFA, formatDateFR } from '@/lib/utils/format';
import { createClient } from '@/lib/supabase/client';
import { Collection } from '@/types/database';

export default function CollectionsPage() {
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<Collection[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function loadCollections() {
      setLoading(true);
      const { data } = await supabase
        .from('collections')
        .select('*, pos:points_of_sale(*), collecteur:profiles(*)')
        .order('created_at', { ascending: false });

      setCollections(data || []);
      setLoading(false);
    }
    loadCollections();
  }, []);

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
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          Chargement des collectes...
        </div>
      ) : collections.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
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
          <div className="overflow-x-auto">
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {collections.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
