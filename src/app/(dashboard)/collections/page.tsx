'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Receipt,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Store,
  User,
  Calendar,
  DollarSign,
  Search,
  ChevronRight,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { formatCurrencyFCFA, formatDateFR } from '@/lib/utils/format';
import { createClient } from '@/lib/supabase/client';
import { useSpaceStore } from '@/lib/stores/spaceStore';
import { useAuthStore } from '@/lib/stores/authStore';
import { Collection } from '@/types/database';
import { AddButton } from '@/components/ui/AddButton';

export default function CollectionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const supabase = createClient();
  const { currentSpaceId } = useSpaceStore();
  const isCollector = useAuthStore((s) => s.user?.role) === 'collecteur';

  useEffect(() => {
    async function loadCollections() {
      setLoading(true);
      let query = supabase
        .from('collections')
        .select('*, pos:points_of_sale(*), collecteur:profiles(*)')
        .order('created_at', { ascending: false });

      if (currentSpaceId) {
        query = query.eq('space_id', currentSpaceId);
      }

      const { data } = await query;
      setCollections(data || []);
      setLoading(false);
    }
    loadCollections();
  }, [currentSpaceId, supabase]);

  // Financial KPIs
  const { totalEncaissé, totalAttendu, totalDifference, totalCommissions } = useMemo(() => {
    return collections.reduce(
      (acc, c) => ({
        totalEncaissé: acc.totalEncaissé + Number(c.montant_collecte || 0),
        totalAttendu: acc.totalAttendu + Number(c.montant_attendu || 0),
        totalDifference: acc.totalDifference + Number(c.difference || 0),
        totalCommissions: acc.totalCommissions + Number(c.commission || 0),
      }),
      { totalEncaissé: 0, totalAttendu: 0, totalDifference: 0, totalCommissions: 0 }
    );
  }, [collections]);

  // Filtered collections
  const filteredCollections = useMemo(() => {
    if (!searchQuery.trim()) return collections;
    const q = searchQuery.toLowerCase().trim();
    return collections.filter((c) => {
      const posName = (c.pos?.nom || '').toLowerCase();
      const collName = (c.collecteur?.nom || '').toLowerCase();
      const notes = (c.notes || '').toLowerCase();
      return posName.includes(q) || collName.includes(q) || notes.includes(q);
    });
  }, [collections, searchQuery]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-brand-600 dark:text-brand-400" />
            <span>{isCollector ? 'Mes collectes' : 'Encaissements & Collectes'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isCollector
              ? 'Les encaissements faits sur vos points de vente.'
              : 'Historique et suivi des levées de fonds et encaissements de caisse.'}
          </p>
        </div>
        <AddButton what="une collecte de caisse" href="/collections/new" />
      </div>

      {/* KPI Highlights Cards */}
      {!loading && collections.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <Card className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
              <Receipt className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Total Encaissé</span>
            </div>
            <p className="text-base sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 truncate">
              {formatCurrencyFCFA(totalEncaissé)}
            </p>
          </Card>

          <Card className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
              <DollarSign className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Total Attendu</span>
            </div>
            <p className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white mt-1 truncate">
              {formatCurrencyFCFA(totalAttendu)}
            </p>
          </Card>

          <Card className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Écart Global</span>
            </div>
            <p
              className={`text-base sm:text-xl font-extrabold mt-1 truncate ${
                totalDifference === 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : totalDifference < 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {totalDifference === 0 ? '0 FCFA' : formatCurrencyFCFA(totalDifference)}
            </p>
          </Card>

          <Card className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Total Collectes</span>
            </div>
            <p className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white mt-1">
              {collections.length}
            </p>
          </Card>
        </div>
      )}

      {/* Search Filter Bar */}
      {!loading && collections.length > 0 && (
        <div className="w-full sm:max-w-xs">
          <Input
            placeholder="Rechercher par POS ou collecteur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            rightElement={<Search className="w-4 h-4 text-slate-400" />}
            className="h-10 text-xs sm:text-sm"
          />
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="py-16 flex flex-col justify-center items-center gap-3 text-slate-500 text-sm font-medium">
          <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
          <span>Chargement des collectes...</span>
        </div>
      ) : collections.length === 0 ? (
        <Card className="p-10 sm:p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
            <Receipt className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Aucun encaissement pour le moment
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Vous n&apos;avez enregistré aucune collecte de caisse. Lancez votre première levée de fonds.
          </p>
          <div className="pt-2">
            <AddButton what="une collecte de caisse" href="/collections/new" />
          </div>
        </Card>
      ) : filteredCollections.length === 0 ? (
        <Card className="p-8 text-center space-y-2">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Aucun résultat trouvé pour &laquo; {searchQuery} &raquo;
          </p>
          <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
            Réinitialiser la recherche
          </Button>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800">
          {/* Desktop Table View (hidden on mobile, visible from md upwards) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Point de Vente</th>
                  <th className="px-4 py-3">Collecteur</th>
                  <th className="px-4 py-3 text-right">Montant Attendu</th>
                  <th className="px-4 py-3 text-right">Montant Encaissé</th>
                  <th className="px-4 py-3 text-right">Commission</th>
                  <th className="px-4 py-3 text-center">Écart (Diff)</th>
                  <th className="px-4 py-3 text-center">Statut</th>
                  <th className="px-4 py-3">Enregistré le</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {filteredCollections.map((c: Collection) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/collections/${c.id}`)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition cursor-pointer group"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Store className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {c.pos?.nom || 'POS'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {c.collecteur?.nom || 'Collecteur'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">
                      {formatCurrencyFCFA(c.montant_attendu)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                      {formatCurrencyFCFA(c.montant_collecte)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">
                      {formatCurrencyFCFA(Number(c.commission || 0))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {Number(c.difference) === 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 0 FCFA
                        </span>
                      ) : Number(c.difference) < 0 ? (
                        <span className="text-red-600 dark:text-red-400 font-bold inline-flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> {formatCurrencyFCFA(c.difference)}
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> +{formatCurrencyFCFA(c.difference)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant={c.statut === 'validee' ? 'success' : c.statut === 'annulee' ? 'danger' : 'warning'}
                      >
                        {c.statut === 'validee' ? 'Validée' : c.statut === 'annulee' ? 'Annulée' : 'Brouillon'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {formatDateFR(c.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500 dark:group-hover:text-brand-400 transition" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout (visible on mobile, hidden from md upwards) */}
          <div className="md:hidden p-3 space-y-3">
            {filteredCollections.map((c: Collection) => (
              <div
                key={`mobile-col-${c.id}`}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/collections/${c.id}`)}
                onKeyDown={(e) => e.key === 'Enter' && router.push(`/collections/${c.id}`)}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-3 shadow-xs cursor-pointer hover:border-brand-500/50 hover:shadow-sm transition active:scale-[0.99]"
              >
                {/* Header: POS + Status Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 border border-brand-500/20">
                      <Store className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {c.pos?.nom || 'Point de Vente'}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        <User className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{c.collecteur?.nom || 'Collecteur'}</span>
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant={c.statut === 'validee' ? 'success' : c.statut === 'annulee' ? 'danger' : 'warning'}
                    className="text-[10px] px-2 py-0.5 shrink-0"
                  >
                    {c.statut === 'validee' ? 'Validée' : c.statut === 'annulee' ? 'Annulée' : 'Brouillon'}
                  </Badge>
                </div>

                {/* Financial Inset Card */}
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">
                      Attendu
                    </span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {formatCurrencyFCFA(Number(c.montant_attendu))}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">
                      Encaissé
                    </span>
                    <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                      {formatCurrencyFCFA(Number(c.montant_collecte))}
                    </span>
                  </div>
                  {Number(c.commission || 0) > 0 && (
                    <div className="col-span-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Commission</span>
                      <span className="font-semibold text-slate-600 dark:text-slate-300">
                        {formatCurrencyFCFA(Number(c.commission))}
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer: Date & Écart (Différence) */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>{formatDateFR(c.created_at)}</span>
                  </div>

                  <div>
                    {Number(c.difference) === 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Conforme
                      </span>
                    ) : Number(c.difference) < 0 ? (
                      <span className="text-red-600 dark:text-red-400 font-bold text-xs flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> {formatCurrencyFCFA(Number(c.difference))}
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> +{formatCurrencyFCFA(Number(c.difference))}
                      </span>
                    )}
                  </div>
                </div>

                {c.notes && (
                  <p className="text-[11px] text-slate-500 italic bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg">
                    &laquo; {c.notes} &raquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
