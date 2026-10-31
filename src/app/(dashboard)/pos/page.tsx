'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Store, Search, MapPin, UserCheck, Loader2, Edit, Power, PowerOff } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EditPosModal } from './edit-pos-modal';
import { PointOfSale, Profile, PosStatus, WifiSpace } from '@/types/database';
import { isActiveProfile } from '@/lib/utils/profiles';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores/authStore';
import { AddButton } from '@/components/ui/AddButton';
import { StatTile } from '@/components/ui/StatTile';

export default function PosPage() {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [posList, setPosList] = useState<PointOfSale[]>([]);
  const [collectors, setCollectors] = useState<Profile[]>([]);
  const [editingPos, setEditingPos] = useState<PointOfSale | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [spaces, setSpaces] = useState<WifiSpace[]>([]);

  const { user } = useAuthStore();
  const isAdmin = user?.role === 'administrateur';

  const supabase = createClient();

  useEffect(() => {
async function loadData() {
    setLoading(true);
    const { data: posData } = await supabase.from('points_of_sale').select('*, collecteur:profiles(*)');

    const { data: colData } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'collecteur');

    const { data: spacesData } = await supabase.from('wifi_spaces').select('*');

    if (colData) setCollectors(colData.filter(isActiveProfile));
    if (spacesData) setSpaces(spacesData);
    setPosList(posData || []);
    setLoading(false);
  }
    loadData();
  }, [supabase]);

  const filteredPos = posList.filter((p: PointOfSale) =>
    p.nom.toLowerCase().includes(search.toLowerCase()) ||
    p.ville.toLowerCase().includes(search.toLowerCase())
  );

  const totalPos = posList.length;
  const activePos = posList.filter((p: PointOfSale) => p.statut === 'actif').length;
  const inactivePos = posList.filter((p: PointOfSale) => p.statut === 'inactif' || p.statut === 'suspendu').length;

  const handleToggleStatus = async (pos: PointOfSale) => {
    if (!isAdmin) return;
    const newStatus: PosStatus = pos.statut === 'actif' ? 'suspendu' : 'actif';
    setTogglingId(pos.id);
    const { error } = await supabase
      .from('points_of_sale')
      .update({ statut: newStatus })
      .eq('id', pos.id);

    if (!error) {
      setPosList((prev) => prev.map((p: PointOfSale) => (p.id === pos.id ? { ...p, statut: newStatus } : p)));
    }
    setTogglingId(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{isAdmin ? 'Points de Vente (POS)' : 'Mes points de vente'}</h1>
          <p className="text-xs text-slate-500">
            {isAdmin
              ? 'Gérez le réseau de distribution et l’attribution des collecteurs.'
              : 'Les points de vente que votre administrateur vous a confiés.'}
          </p>
        </div>
        {isAdmin && <AddButton what="un point de vente" onClick={() => setIsModalOpen(true)} />}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatTile
          label="Total POS"
          value={totalPos}
          icon={Store}
          accent="amber"
        />

        <StatTile
          label="Actifs"
          value={activePos}
          icon={Power}
          accent="emerald"
        />

        <StatTile
          label="Désactivés"
          value={inactivePos}
          icon={PowerOff}
          accent="red"
          className="col-span-2 sm:col-span-1"
        />
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
            {isAdmin
              ? 'Vous n’avez pas encore configuré de point de vente. Ajoutez votre premier emplacement pour démarrer les encaissements.'
              : 'Aucun point de vente ne vous est attribué pour le moment. Demandez à votre administrateur de vous en confier.'}
          </p>
          {isAdmin && <AddButton what="un point de vente" onClick={() => setIsModalOpen(true)} />}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPos.map((pos: PointOfSale) => (
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
            setPosList(posList.map((p: PointOfSale) => (p.id === updated.id ? updated : p)));
          } else {
            setPosList([updated, ...posList]);
          }
        }}
      />
    </div>
  );
}
