'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Store, Search, MapPin, UserCheck, Loader2, Edit, Power, PowerOff } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { WriteButton } from '@/components/ui/WriteButton';
import { Badge } from '@/components/ui/Badge';
import { EditPosModal } from './edit-pos-modal';
import { PointOfSale, Profile, PosStatus, WifiSpace } from '@/types/database';
import { isActiveProfile } from '@/lib/utils/profiles';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores/authStore';
import { AddButton } from '@/components/ui/AddButton';
import { StatTile } from '@/components/ui/StatTile';
import { KpiGrid } from '@/components/ui/KpiGrid';
import { useGuideOpenForm } from '@/lib/onboarding';

export default function PosPage() {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Guide de démarrage : « Ajouter un point de vente » ouvre le formulaire
  useGuideOpenForm(() => setIsModalOpen(true));
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{isAdmin ? 'Points de Vente (POS)' : 'Mes points de vente'}</h1>
          <p className="text-xs text-muted">
            {isAdmin
              ? 'Gérez le réseau de distribution et l’attribution des collecteurs.'
              : 'Les points de vente que votre administrateur vous a confiés.'}
          </p>
        </div>
        {isAdmin && <AddButton what="un point de vente" tour="add:pos" onClick={() => setIsModalOpen(true)} />}
      </div>

      {/* KPI Cards */}
      <KpiGrid cols={{ base: 2, sm: 3 }}>
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
      </KpiGrid>

      {/* Filter Bar */}
      <Card>
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted" />
          <input
            type="text"
            placeholder="Rechercher par nom ou ville..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input--primary w-full pl-9 pr-4"
          />
        </div>
      </Card>

      {/* Grid POS Cards or Empty State */}
      {loading ? (
        <div className="py-10 flex justify-center items-center gap-2 text-muted text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-accent" />
          Chargement des points de vente...
        </div>
      ) : filteredPos.length === 0 ? (
        <Card className="text-center space-y-3 py-8">
          <div className="w-14 h-14 rounded-full bg-warning-soft text-warning-soft-foreground flex items-center justify-center mx-auto">
            <Store className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Aucun point de vente trouvé</h3>
          <p className="text-xs text-muted max-w-sm mx-auto">
            {isAdmin
              ? 'Vous n’avez pas encore configuré de point de vente. Ajoutez votre premier emplacement pour démarrer les encaissements.'
              : 'Aucun point de vente ne vous est attribué pour le moment. Demandez à votre administrateur de vous en confier.'}
          </p>
          {isAdmin && <AddButton what="un point de vente" tour="add:pos" onClick={() => setIsModalOpen(true)} />}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredPos.map((pos: PointOfSale) => (
            <Link key={pos.id} href={`/pos/${pos.id}`} className="block group">
              <Card className="space-y-4 hover:border-warning/50 transition cursor-pointer h-full">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-accent-soft text-accent">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-foreground">{pos.nom}</h3>
                      <div className="flex items-center gap-1 text-xs text-muted mt-0.5">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{pos.adresse || pos.ville}</span>
                      </div>
                    </div>
                  </div>
                  <Badge variant={pos.statut === 'actif' ? 'success' : 'neutral'}>
                    {pos.statut === 'actif' ? 'Actif' : pos.statut === 'inactif' ? 'Inactif' : pos.statut}
                  </Badge>
                </div>

                <div className="pt-3 border-t border-separator flex items-center justify-between text-xs text-muted">
                  <div className="flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-success-soft-foreground" />
                    <span>Collecteur : <strong className="text-foreground">{pos.collecteur?.nom || 'Non attribué'}</strong></span>
                  </div>
                  <span className="text-xs text-muted">ID #{pos.id.slice(0, 4)}</span>
                </div>

                {/* Actions de l'administrateur : toujours visibles (y compris sur téléphone), avec libellé */}
                {isAdmin && (
                  <div className="grid grid-cols-2 gap-2">
                    <WriteButton
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingPos(pos);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                      Modifier
                    </WriteButton>
                    <WriteButton
                      variant="outline"
                      size="sm"
                      disabled={togglingId === pos.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleToggleStatus(pos);
                      }}
                    >
                      {togglingId === pos.id ? (
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      ) : pos.statut === 'actif' ? (
                        <PowerOff className="w-4 h-4 mr-1.5" />
                      ) : (
                        <Power className="w-4 h-4 mr-1.5" />
                      )}
                      {pos.statut === 'actif' ? 'Désactiver' : 'Activer'}
                    </WriteButton>
                  </div>
                )}
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
