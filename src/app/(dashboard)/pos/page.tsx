'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Store, Plus, Search, MapPin, UserCheck, Loader2, Edit, Power, PowerOff, ArrowLeftRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EditPosModal } from './edit-pos-modal';
import { PointOfSale, Profile, PosStatus, WifiSpace, TicketType, TicketAllocation } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores/authStore';
import { formatCurrencyFCFA } from '@/lib/utils/format';

export default function PosPage() {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [posList, setPosList] = useState<PointOfSale[]>([]);
  const [collectors, setCollectors] = useState<Profile[]>([]);
  const [editingPos, setEditingPos] = useState<PointOfSale | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [spaces, setSpaces] = useState<WifiSpace[]>([]);
  const [allocations, setAllocations] = useState<TicketAllocation[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);

  const { user } = useAuthStore();
  const isAdmin = user?.role === 'administrateur';

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      if (!user?.organization_id) return;
      setLoading(true);
      const [posRes, colRes, spacesRes, allocRes, ticketRes] = await Promise.all([
        supabase
          .from('points_of_sale')
          .select('*, collecteur:profiles(*)')
          .eq('organization_id', user.organization_id),
        supabase
          .from('profiles')
          .select('*')
          .eq('organization_id', user.organization_id)
          .eq('role', 'collecteur'),
        supabase
          .from('wifi_spaces')
          .select('*')
          .eq('organization_id', user.organization_id),
        supabase
          .from('ticket_allocations')
          .select('*, ticket_type:ticket_types(*)')
          .eq('organization_id', user.organization_id),
        supabase
          .from('ticket_types')
          .select('*')
          .eq('organization_id', user.organization_id),
      ]);

      if (posRes.data) setPosList(posRes.data);
      if (colRes.data) setCollectors(colRes.data);
      if (spacesRes.data) setSpaces(spacesRes.data);
      if (allocRes.data) setAllocations(allocRes.data);
      if (ticketRes.data) setTicketTypes(ticketRes.data);
      setLoading(false);
    }
    loadData();
  }, [user?.organization_id, supabase]);

  const filteredPos = posList.filter((p) =>
    p.nom.toLowerCase().includes(search.toLowerCase()) ||
    p.ville.toLowerCase().includes(search.toLowerCase())
  );

  const totalPos = posList.length;
  const activePos = posList.filter((p) => p.statut === 'actif').length;
  const inactivePos = posList.filter((p) => p.statut === 'inactif' || p.statut === 'suspendu').length;

  function computePosStockValue(posId: string): number {
    return allocations
      .filter((a) => a.pos_id === posId)
      .reduce((sum, a) => {
        const tt = ticketTypes.find((t) => t.id === a.ticket_type_id) || a.ticket_type;
        const qty = a.type === 'exchange_return' ? -a.quantite : a.quantite;
        return sum + qty * (tt?.prix || 0);
      }, 0);
  }

  const stockValueByPos = new Map<string, number>();
  posList.forEach((pos) => {
    stockValueByPos.set(pos.id, computePosStockValue(pos.id));
  });

  const totalStockValue = Array.from(stockValueByPos.values()).reduce(
    (sum, value) => sum + value,
    0
  );

  const handleToggleStatus = async (pos: PointOfSale) => {
    if (!isAdmin) return;
    const newStatus: PosStatus = pos.statut === 'actif' ? 'suspendu' : 'actif';
    setTogglingId(pos.id);
    const { error } = await supabase
      .from('points_of_sale')
      .update({ statut: newStatus })
      .eq('id', pos.id);

    if (!error) {
      setPosList((prev) => prev.map((p) => (p.id === pos.id ? { ...p, statut: newStatus } : p)));
    }
    setTogglingId(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Points de Vente (POS)</h1>
          <p className="text-xs text-slate-500">Gérez le réseau de distribution et l&apos;attribution des collecteurs.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2 font-semibold">
          <Plus className="w-4 h-4" />
          Ajouter un POS
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total POS</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
              <Store className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-3">{totalPos}</p>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Actifs</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
              <Power className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-3">{activePos}</p>
        </Card>

        <Card className="border-l-4 border-l-red-500 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Désactivés</span>
            <div className="p-2 rounded-lg bg-red-500/10 text-red-600">
              <PowerOff className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-3">{inactivePos}</p>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Valeur du stock alloué</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-3">
            {formatCurrencyFCFA(totalStockValue)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Total cumulé sur tous les POS</p>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par nom ou ville..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </Card>

      {/* Grid POS Cards or Empty State */}
      {loading ? (
        <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          Chargement des points de vente...
        </div>
      ) : filteredPos.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
            <Store className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucun point de vente trouvé</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Vous n&apos;avez pas encore configuré de point de vente. Ajoutez votre premier emplacement pour démarrer les encaissements.
          </p>
          <Button onClick={() => setIsModalOpen(true)} variant="secondary" className="font-bold gap-2">
            <Plus className="w-4 h-4" /> Ajouter mon premier POS
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPos.map((pos) => (
            <Link key={pos.id} href={`/pos/${pos.id}`} className="block group">
              <Card className="space-y-4 hover:border-amber-500/50 transition cursor-pointer h-full">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-900/10 text-blue-900 dark:text-amber-400 border border-blue-900/20">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">{pos.nom}</h3>
                      <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{pos.adresse || pos.ville}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={pos.statut === 'actif' ? 'success' : 'neutral'}>
                      {pos.statut}
                    </Badge>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleToggleStatus(pos);
                        }}
                        disabled={togglingId === pos.id}
                        title={pos.statut === 'actif' ? 'Désactiver le POS' : 'Activer le POS'}
                      >
                        {togglingId === pos.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : pos.statut === 'actif' ? (
                          <PowerOff className="w-3.5 h-3.5" />
                        ) : (
                          <Power className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingPos(pos);
                      }}
                      title="Modifier le POS"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Collecteur : <strong className="text-slate-800 dark:text-slate-200">{pos.collecteur?.nom || 'Non attribué'}</strong></span>
                  </div>
                  <span className="text-[11px] text-slate-400">ID #{pos.id.slice(0, 4)}</span>
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <ArrowLeftRight className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-slate-500">Valeur du stock alloué</span>
                  </div>
                  <span className="font-bold text-amber-600">
                    {formatCurrencyFCFA(stockValueByPos.get(pos.id) || 0)}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

  {/* Edit/Create POS Modal */}
      <EditPosModal
        key={`edit-pos-${editingPos?.id || 'new'}`}
        isOpen={isModalOpen || !!editingPos}
        onClose={() => {
          setIsModalOpen(false);
          setEditingPos(null);
        }}
        pos={editingPos}
        collectors={collectors}
        spaces={spaces}
        onSuccess={(updated) => {
          if (editingPos) {
            setPosList(posList.map((p) => (p.id === updated.id ? updated : p)));
          } else {
            setPosList([updated, ...posList]);
          }
        }}
      />
    </div>
  );
}
