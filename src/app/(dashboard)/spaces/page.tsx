'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Edit, Trash2, MapPin, Loader2, AlertCircle, Store, Link2, Unlink, Search, Power, PowerOff } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores/authStore';
import { WifiSpace, PointOfSale } from '@/types/database';

export default function WifiSpacesPage() {
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [spaces, setSpaces] = useState<WifiSpace[]>([]);
  const [allPos, setAllPos] = useState<PointOfSale[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSpace, setEditingSpace] = useState<WifiSpace | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [managePosSpaceId, setManagePosSpaceId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [adresse, setAdresse] = useState('');
  const [ville, setVille] = useState('');
  const [statut, setStatut] = useState<'actif' | 'inactif' | 'suspendu'>('actif');

  const supabase = createClient();
  const isAdmin = user?.role === 'administrateur';

  useEffect(() => {
    async function loadAll() {
      if (!user?.organization_id) return;
      setLoading(true);
      const [spacesRes, posRes] = await Promise.all([
        supabase.from('wifi_spaces').select('*').eq('organization_id', user.organization_id).order('created_at', { ascending: false }),
        supabase.from('points_of_sale').select('*').eq('organization_id', user.organization_id).order('nom'),
      ]);
      if (spacesRes.data) setSpaces(spacesRes.data);
      if (posRes.data) setAllPos(posRes.data);
      setLoading(false);
    }
    loadAll();
  }, [user?.organization_id, supabase]);

  const filteredSpaces = spaces.filter((s) =>
    s.nom.toLowerCase().includes(search.toLowerCase()) ||
    (s.ville || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.adresse || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalSpaces = spaces.length;
  const activeSpaces = spaces.filter((s) => s.statut === 'actif').length;
  const inactiveSpaces = spaces.filter((s) => s.statut === 'inactif' || s.statut === 'suspendu').length;

  const resetForm = () => {
    setNom('');
    setDescription('');
    setAdresse('');
    setVille('');
    setStatut('actif');
    setEditingSpace(null);
  };

  const handleOpenModal = (space?: WifiSpace) => {
    if (space) {
      setEditingSpace(space);
      setNom(space.nom);
      setDescription(space.description || '');
      setAdresse(space.adresse || '');
      setVille(space.ville || '');
      setStatut(space.statut);
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) return;

    setSubmitting(true);

    const spaceData = {
      nom: nom.trim(),
      description: description.trim() || undefined,
      adresse: adresse.trim() || undefined,
      ville: ville.trim() || undefined,
      statut,
      organization_id: user?.organization_id || null,
      updated_at: new Date().toISOString(),
    };

    if (editingSpace) {
      const { error } = await supabase.from('wifi_spaces').update(spaceData).eq('id', editingSpace.id);
      if (error) {
        toast.error('Erreur lors de la mise à jour de l\'espace');
      } else {
        toast.success('Espace mis à jour avec succès');
        setSpaces((prev) => prev.map((s) => (s.id === editingSpace.id ? { ...s, ...spaceData } : s)));
        handleCloseModal();
      }
    } else {
      const { data, error } = await supabase.from('wifi_spaces').insert(spaceData).select().single();
      if (error) {
        toast.error('Erreur lors de la création de l\'espace');
      } else if (data) {
        toast.success('Espace créé avec succès');
        setSpaces((prev) => [data, ...prev]);
        handleCloseModal();
      }
    }

    setSubmitting(false);
  };

  const handleToggleStatus = async (space: WifiSpace) => {
    if (!isAdmin) return;
    const newStatus = space.statut === 'actif' ? 'inactif' : 'actif';
    setTogglingId(space.id);
    const { error } = await supabase
      .from('wifi_spaces')
      .update({ statut: newStatus })
      .eq('id', space.id);

    if (!error) {
      setSpaces((prev) => prev.map((s) => (s.id === space.id ? { ...s, statut: newStatus } : s)));
      toast.success(`Espace ${newStatus === 'actif' ? 'activé' : 'désactivé'}`);
    }
    setTogglingId(null);
  };

  const handleDelete = async (id: string) => {
    const linkedCount = allPos.filter((p) => p.space_id === id).length;
    const message =
      linkedCount > 0
        ? `Supprimer cet espace détachera ${linkedCount} point(s) de vente. Continuer ?`
        : 'Supprimer cet espace ?';
    if (!window.confirm(message)) return;

    if (linkedCount > 0) {
      await supabase.from('points_of_sale').update({ space_id: null }).eq('space_id', id);
      setAllPos((prev) => prev.map((p) => (p.space_id === id ? { ...p, space_id: undefined } : p)));
    }
    const { error } = await supabase.from('wifi_spaces').delete().eq('id', id);
    if (error) {
      toast.error('Erreur lors de la suppression de l\'espace');
    } else {
      toast.success('Espace supprimé avec succès');
      setSpaces((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const handleLinkPos = async (spaceId: string, posId: string) => {
    const { error } = await supabase.from('points_of_sale').update({ space_id: spaceId }).eq('id', posId);
    if (error) {
      toast.error('Erreur lors de l\'attachement du POS');
    } else {
      setAllPos((prev) => prev.map((p) => (p.id === posId ? { ...p, space_id: spaceId } : p)));
      toast.success('POS rattaché à l\'espace');
    }
  };

  const handleUnlinkPos = async (posId: string) => {
    const { error } = await supabase.from('points_of_sale').update({ space_id: null }).eq('id', posId);
    if (error) {
      toast.error('Erreur lors du détachement du POS');
    } else {
      setAllPos((prev) => prev.map((p) => (p.id === posId ? { ...p, space_id: undefined } : p)));
      toast.success('POS détaché de l\'espace');
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
        Chargement des espaces...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Espaces Wi-Fi</h1>
          <p className="text-xs text-slate-500">Gérez vos zones géographiques et regroupez vos points de vente.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => handleOpenModal()} className="gap-2 font-semibold">
            <Plus className="w-4 h-4" />
            Créer un Espace
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      {/* KPI Cards — 2 par ligne sur mobile, la 3e tuile occupe la ligne, 3 a partir de lg */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <StatTile
          label="Total Espaces"
          value={totalSpaces}
          hint="Tous les espaces enregistrés"
          icon={MapPin}
          tone="brand"
        />
        <StatTile
          label="Actifs"
          value={activeSpaces}
          hint="Ouverts et opérationnels"
          icon={Power}
          tone="emerald"
        />
        <StatTile
          label="Désactivés"
          value={inactiveSpaces}
          hint="Fermés ou désactivés"
          icon={PowerOff}
          tone="red"
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, ville ou adresse..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </Card>

      {/* Grid Space Cards or Empty State */}
      {filteredSpaces.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-brand-500/10 text-brand-500 flex items-center justify-center mx-auto">
            <MapPin className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucun espace trouvé</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {spaces.length === 0
              ? 'Créez votre premier espace Wi-Fi pour commencer à organiser vos points de vente.'
              : 'Aucun espace ne correspond à votre recherche.'}
          </p>
          {isAdmin && spaces.length === 0 && (
            <Button onClick={() => handleOpenModal()} variant="secondary" className="font-bold gap-2">
              <Plus className="w-4 h-4" /> Créer mon premier espace
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSpaces.map((space) => {
            const linkedPos = allPos.filter((p) => p.space_id === space.id);
            const unlinkedPos = allPos.filter((p) => !p.space_id);
            const isManaging = managePosSpaceId === space.id;

            return (
              <Link key={space.id} href={`/spaces/${space.id}`} className="block group">
                <Card className="space-y-3 h-full">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-500 border border-brand-500/20">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">{space.nom}</h3>
                        <p className="text-xs text-slate-500 mt-1">{space.description || 'Aucune description'}</p>
                        {(space.adresse || space.ville) && (
                          <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                            <MapPin className="w-3 h-3" />
                            <span>
                              {[space.adresse, space.ville].filter(Boolean).join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          space.statut === 'actif'
                            ? 'success'
                            : space.statut === 'suspendu'
                            ? 'danger'
                            : 'neutral'
                        }
                      >
                        {space.statut}
                      </Badge>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleToggleStatus(space);
                          }}
                          disabled={togglingId === space.id}
                          className="p-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          title={space.statut === 'actif' ? 'Désactiver' : 'Activer'}
                        >
                          {togglingId === space.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : space.statut === 'actif' ? (
                            <PowerOff className="w-3.5 h-3.5" />
                          ) : (
                            <Power className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Linked POS count */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="p-1.5 rounded-lg bg-blue-900/10 text-blue-900 dark:text-blue-400">
                      <Store className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      {linkedPos.length} point{linkedPos.length > 1 ? 's' : ''} de vente rattaché
                      {linkedPos.length > 1 ? 's' : ''}
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingSpace ? "Modifier l'Espace" : 'Créer un Espace Wi-Fi'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Nom de l'espace"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="ex: Espace A - Cours"
                  required
                />
                <Input
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="ex: Zone résidentielle principale"
                />
                <Input
                  label="Adresse"
                  value={adresse}
                  onChange={(e) => setAdresse(e.target.value)}
                  placeholder="ex: Rue 12, Plateau"
                />
                <Input
                  label="Ville"
                  value={ville}
                  onChange={(e) => setVille(e.target.value)}
                  placeholder="ex: Abidjan"
                />
                <Select
                  label="Statut"
                  value={statut}
                  onChange={(v) => setStatut(v as 'actif' | 'inactif' | 'suspendu')}
                  options={[
                    { value: 'actif', label: 'Actif' },
                    { value: 'inactif', label: 'Inactif' },
                    { value: 'suspendu', label: 'Suspendu' },
                  ]}
                />
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="ghost" onClick={handleCloseModal}>
                    Annuler
                  </Button>
                  <Button type="submit" variant="secondary" isLoading={submitting}>
                    {editingSpace ? 'Mettre à jour' : 'Créer'}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}