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
import { formatAmountShort, formatCurrencyFCFA, formatDateFR, formatNumber } from '@/lib/utils/format';
import { StatTile } from '@/components/ui/StatTile';
import { KpiGrid } from '@/components/ui/KpiGrid';
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
  const user = useAuthStore((s) => s.user);
  const isCollector = user?.role === 'collecteur';
  // Compte point de vente : consultation seule des collectes faites chez lui (filtrées côté serveur)
  const isPosAccount = user?.role === 'point_de_vente';

  useEffect(() => {
    async function loadCollections() {
      setLoading(true);
      let query = supabase
        .from('collections')
        .select('*, pos:points_of_sale(*), collecteur:profiles(*)')
        .order('created_at', { ascending: false });

      if (currentSpaceId && !isPosAccount) {
        query = query.eq('space_id', currentSpaceId);
      }
      // Le collecteur ne voit ici que les collectes qu'il a faites (mêmes chiffres que « Ma tournée »)
      if (isCollector && user?.id) {
        query = query.eq('collecteur_id', user.id);
      }

      const { data } = await query;
      setCollections(data || []);
      setLoading(false);
    }
    loadCollections();
  }, [currentSpaceId, supabase, isCollector, isPosAccount, user?.id]);

  // Financial KPIs
  const { totalEncaissé, totalAttendu, totalDifference, totalCommissions } = useMemo(() => {
    // Les collectes annulées ne comptent pas dans les totaux (comme sur les tableaux de bord)
    return collections.filter((c) => c.statut !== 'annulee').reduce(
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
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-muted" />
            <span>{isCollector || isPosAccount ? 'Mes collectes' : 'Encaissements & Collectes'}</span>
          </h1>
          <p className="text-xs text-muted mt-0.5">
            {isPosAccount
              ? 'Les collectes faites dans votre point de vente (consultation seule).'
              : isCollector
              ? 'Les encaissements faits sur vos points de vente.'
              : 'Historique et suivi des levées de fonds et encaissements de caisse.'}
          </p>
        </div>
        {!isPosAccount && <AddButton what="une collecte de caisse" tour="add:collection" href="/collections/new" />}
      </div>

      {/* Chiffres clés : mêmes cadres que le tableau de bord et les rapports */}
      {!loading && collections.length > 0 && (
        <KpiGrid cols={{ base: 2, lg: 4 }}>
          <StatTile label="Total encaissé" value={formatAmountShort(totalEncaissé)} icon={Receipt} accent="emerald" hint="Argent effectivement collecté" />
          <StatTile label="Total attendu" value={formatAmountShort(totalAttendu)} icon={DollarSign} accent="indigo" hint="D’après les tickets vendus" />
          <StatTile
            label="Écart global"
            value={formatAmountShort(totalDifference)}
            icon={AlertTriangle}
            accent={totalDifference < 0 ? 'red' : 'amber'}
            alert={totalDifference < 0}
            hint={totalDifference < 0 ? 'Manque à encaisser' : totalDifference > 0 ? 'Excédent de caisse' : 'Aucun écart'}
          />
          <StatTile label="Collectes" value={formatNumber(collections.length)} icon={CheckCircle2} accent="slate" hint="Encaissements enregistrés" />
        </KpiGrid>
      )}

      {/* Search Filter Bar */}
      {!loading && collections.length > 0 && (
        <div className="w-full sm:max-w-xs">
          <Input
            placeholder="Rechercher par POS ou collecteur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            rightElement={<Search className="w-4 h-4 text-muted" />}
            className="h-10 text-xs sm:text-sm"
          />
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="py-10 flex flex-col justify-center items-center gap-3 text-muted text-sm font-medium">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
          <span>Chargement des collectes...</span>
        </div>
      ) : collections.length === 0 ? (
        <Card className="text-center space-y-3 py-8">
          <div className="w-14 h-14 rounded-xl bg-warning-soft text-warning-soft-foreground flex items-center justify-center mx-auto">
            <Receipt className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            Aucun encaissement pour le moment
          </h3>
          <p className="text-xs text-muted max-w-sm mx-auto">
            {isPosAccount
              ? 'Aucune collecte n’a encore été faite dans votre point de vente.'
              : 'Vous n’avez enregistré aucune collecte de caisse. Lancez votre première levée de fonds.'}
          </p>
          {!isPosAccount && (
            <div className="pt-2">
              <AddButton what="une collecte de caisse" tour="add:collection" href="/collections/new" />
            </div>
          )}
        </Card>
      ) : filteredCollections.length === 0 ? (
        <Card className="text-center space-y-2 py-8">
          <p className="text-sm font-semibold text-foreground">
            Aucun résultat trouvé pour &laquo; {searchQuery} &raquo;
          </p>
          <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
            Réinitialiser la recherche
          </Button>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden border-border">
          {/* Desktop Table View (hidden on mobile, visible from md upwards) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-default text-muted font-semibold">
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
              <tbody className="divide-y divide-separator font-medium">
                {filteredCollections.map((c: Collection) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/collections/${c.id}`)}
                    className="hover:bg-surface-secondary transition cursor-pointer group"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Store className="w-3.5 h-3.5 text-accent shrink-0" />
                        <span className="font-semibold text-foreground">
                          {c.pos?.nom || 'POS'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {c.collecteur?.nom || 'Collecteur'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-muted">
                      {formatCurrencyFCFA(c.montant_attendu)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">
                      {formatCurrencyFCFA(c.montant_collecte)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-muted">
                      {formatCurrencyFCFA(Number(c.commission || 0))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {Number(c.difference) === 0 ? (
                        <span className="text-success-soft-foreground font-semibold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {formatCurrencyFCFA(0)}
                        </span>
                      ) : Number(c.difference) < 0 ? (
                        <span className="text-danger font-semibold inline-flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> {formatCurrencyFCFA(c.difference)}
                        </span>
                      ) : (
                        <span className="text-success-soft-foreground font-semibold inline-flex items-center gap-1">
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
                    <td className="px-4 py-3 text-muted whitespace-nowrap">
                      {formatDateFR(c.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-muted group-hover:text-accent transition" />
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
                className="p-3.5 rounded-2xl bg-surface border border-border space-y-3 shadow-xs cursor-pointer hover:border-accent/50 hover:shadow-sm transition active:scale-[0.99]"
              >
                {/* Header: POS + Status Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0">
                      <Store className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm text-foreground truncate">
                        {c.pos?.nom || 'Point de Vente'}
                      </h4>
                      <div className="flex items-center gap-1.5 text-xs text-muted mt-0.5">
                        <User className="w-3 h-3 text-muted shrink-0" />
                        <span className="truncate">{c.collecteur?.nom || 'Collecteur'}</span>
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant={c.statut === 'validee' ? 'success' : c.statut === 'annulee' ? 'danger' : 'warning'}
                    className="text-xs px-2 py-0.5 shrink-0"
                  >
                    {c.statut === 'validee' ? 'Validée' : c.statut === 'annulee' ? 'Annulée' : 'Brouillon'}
                  </Badge>
                </div>

                {/* Financial Inset Card */}
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-surface-secondary">
                  <div>
                    <span className="text-xs font-semibold text-muted block">
                      Attendu
                    </span>
                    <span className="text-xs font-semibold text-foreground">
                      {formatCurrencyFCFA(Number(c.montant_attendu))}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-muted block">
                      Encaissé
                    </span>
                    <span className="text-sm font-semibold text-success-soft-foreground">
                      {formatCurrencyFCFA(Number(c.montant_collecte))}
                    </span>
                  </div>
                  {Number(c.commission || 0) > 0 && (
                    <div className="col-span-2 pt-1 border-t border-border flex items-center justify-between text-xs">
                      <span className="text-muted font-medium">Commission</span>
                      <span className="font-semibold text-muted">
                        {formatCurrencyFCFA(Number(c.commission))}
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer: Date & Écart (Différence) */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-separator">
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>{formatDateFR(c.created_at)}</span>
                  </div>

                  <div>
                    {Number(c.difference) === 0 ? (
                      <span className="text-success-soft-foreground font-semibold text-xs flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Conforme
                      </span>
                    ) : Number(c.difference) < 0 ? (
                      <span className="text-danger font-semibold text-xs flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> {formatCurrencyFCFA(Number(c.difference))}
                      </span>
                    ) : (
                      <span className="text-success-soft-foreground font-semibold text-xs flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> +{formatCurrencyFCFA(Number(c.difference))}
                      </span>
                    )}
                  </div>
                </div>

                {c.notes && (
                  <p className="text-xs text-muted italic bg-surface-secondary p-2 rounded-xl">
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
