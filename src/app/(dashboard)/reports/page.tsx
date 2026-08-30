'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FileSpreadsheet, Download, Store, Users, Ticket, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatCurrencyFCFA, formatDateFR } from '@/lib/utils/format';
import { createClient } from '@/lib/supabase/client';
import { useSpaceStore } from '@/lib/stores/spaceStore';
import { Collection, PointOfSale } from '@/types/database';

export default function ReportsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [posList, setPosList] = useState<PointOfSale[]>([]);
  const [collectorsCount, setCollectorsCount] = useState(0);
  const [posCount, setPosCount] = useState(0);
  const [ticketsSold, setTicketsSold] = useState(0);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const supabase = createClient();
  const { currentSpaceId } = useSpaceStore();

  useEffect(() => {
    async function loadData() {
      let posQuery = supabase.from('points_of_sale').select('*');
      let itemsQuery = supabase.from('collection_items').select('quantite_vendue');
      let collectionsQuery = supabase
        .from('collections')
        .select('*, pos:points_of_sale(*), collecteur:profiles(*)')
        .order('created_at', { ascending: false });

      if (currentSpaceId) {
        posQuery = posQuery.eq('space_id', currentSpaceId);
        itemsQuery = itemsQuery.eq('space_id', currentSpaceId);
        collectionsQuery = collectionsQuery.eq('space_id', currentSpaceId);
      }

      const { data: posData } = await posQuery;
      setPosList(posData || []);
      setPosCount(posData?.length || 0);

      const { count: collectors } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'collecteur');
      setCollectorsCount(collectors || 0);

      const { data: itemsData } = await itemsQuery;
      const sold = itemsData?.reduce((acc, curr) => acc + (curr.quantite_vendue || 0), 0) || 0;
      setTicketsSold(sold);

      if (startDate) collectionsQuery = collectionsQuery.gte('date_collecte', startDate);
      if (endDate) collectionsQuery = collectionsQuery.lte('date_collecte', endDate);

      const { data: colData } = await collectionsQuery;
      setCollections(colData || []);
    }
    loadData();
  }, [startDate, endDate, currentSpaceId, supabase]);

  const downloadCSV = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTimestamp = useCallback(() => {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  }, []);

  const exportCollectionsCSV = useCallback(() => {
    const header = 'Date,Point de Vente,Collecteur,Montant Attendu,Montant Encaissé,Commission,Écart,Statut\n';
    const rows = collections.map((c) => {
      const date = c.date_collecte ? formatDateFR(c.date_collecte) : formatDateFR(c.created_at);
      return [
        date,
        c.pos?.nom || 'POS',
        c.collecteur?.nom || 'Collecteur',
        Number(c.montant_attendu || 0).toFixed(2),
        Number(c.montant_collecte || 0).toFixed(2),
        Number(c.commission || 0).toFixed(2),
        Number(c.difference || 0).toFixed(2),
        c.statut,
      ].join(',');
    }).join('\n');

    downloadCSV(`encaissements_${getTimestamp()}.csv`, header + rows);
  }, [collections, getTimestamp]);

  const exportPosCSV = useCallback(() => {
    const header = 'Nom,Ville,Statut,Collecteur,Creation\n';
    const rows = posList.map((p) => {
      return [
        p.nom,
        p.ville,
        p.statut,
        p.collecteur?.nom || 'Non attribué',
        formatDateFR(p.created_at),
      ].join(',');
    }).join('\n');

    downloadCSV(`points_de_vente_${getTimestamp()}.csv`, header + rows);
  }, [posList, getTimestamp]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Rapports & Exports CSV</h1>
          <p className="text-xs text-slate-500">Consolidez les données d&apos;exploitation et téléchargez les rapports comptables.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Points de Vente</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
              <Store className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-3">{posCount}</p>
        </Card>

        <Card className="border-l-4 border-l-blue-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Collecteurs</span>
            <div className="p-2 rounded-lg bg-blue-900/10 text-blue-900 dark:text-blue-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-3">{collectorsCount}</p>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tickets Vendus</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
              <Ticket className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-3">{ticketsSold}</p>
        </Card>
      </div>

      <Card className="space-y-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-amber-500" />
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Filtrer par période</p>
            <p className="text-xs text-slate-500">Sélectionnez une plage de dates pour affiner les rapports.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Date de début"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="Date de fin"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="space-y-4 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Rapport des Encaissements</h3>
              <p className="text-xs text-slate-500">{collections.length} collecte(s) trouvée(s) pour la période.</p>
            </div>
          </div>
          <Button onClick={exportCollectionsCSV} variant="secondary" className="w-full gap-2 font-bold">
            <Download className="w-4 h-4" /> Exporter en CSV (.csv)
          </Button>
        </Card>

        <Card className="space-y-4 border-l-4 border-l-blue-900">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-900/10 text-blue-900 dark:text-amber-400">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Rapport des Points de Vente</h3>
              <p className="text-xs text-slate-500">{posList.length} point(s) de vente enregistré(s).</p>
            </div>
          </div>
          <Button onClick={exportPosCSV} className="w-full gap-2 font-bold">
            <Download className="w-4 h-4" /> Exporter en CSV (.csv)
          </Button>
        </Card>
      </div>

      {collections.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Aperçu des Encaissements</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">POS</th>
                  <th className="px-4 py-3">Collecteur</th>
                  <th className="px-4 py-3 text-right">Attendu</th>
                  <th className="px-4 py-3 text-right">Encaissé</th>
                  <th className="px-4 py-3 text-right">Commission</th>
                  <th className="px-4 py-3 text-right">Écart</th>
                  <th className="px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {collections.slice(0, 20).map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {c.date_collecte ? formatDateFR(c.date_collecte) : formatDateFR(c.created_at)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{c.pos?.nom || 'POS'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{c.collecteur?.nom || 'Collecteur'}</td>
                    <td className="px-4 py-3 text-right">{formatCurrencyFCFA(Number(c.montant_attendu))}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">{formatCurrencyFCFA(Number(c.montant_collecte))}</td>
                    <td className="px-4 py-3 text-right">{formatCurrencyFCFA(Number(c.commission || 0))}</td>
                    <td className="px-4 py-3 text-right">{formatCurrencyFCFA(Number(c.difference || 0))}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold ${c.statut === 'validee' ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {c.statut === 'validee' ? 'Validée' : 'Brouillon'}
                      </span>
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
