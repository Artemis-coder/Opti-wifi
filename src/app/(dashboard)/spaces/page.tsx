'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Edit, Trash2, MapPin, Loader2, AlertCircle, Store, Link2, Unlink } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores/authStore';
import { WifiSpace, PointOfSale } from '@/types/database';

export default function WifiSpacesPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [spaces, setSpaces] = useState<WifiSpace[]>([]);
  const [allPos, setAllPos] = useState<PointOfSale[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSpace, setEditingSpace] = useState<WifiSpace | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [managePosSpaceId, setManagePosSpaceId] = useState<string | null>(null);

  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [adresse, setAdresse] = useState('');
  const [ville, setVille] = useState('');
  const [statut, setStatut] = useState<'actif' | 'inactif' | 'suspendu'>('actif');

  const supabase = createClient();

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      const [spacesRes, posRes] = await Promise.all([
        supabase.from('wifi_spaces').select('*').order('created_at', { ascending: false }),
        supabase.from('points_of_sale').select('*').order('nom'),
      ]);
      if (spacesRes.data) setSpaces(spacesRes.data);
      if (posRes.data) setAllPos(posRes.data);
      setLoading(false);
    }
    loadAll();
  }, [supabase]);

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
        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
        Chargement des espaces...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Espaces Wi-Fi</h1>
          <p className="text-xs text-slate-500">
            Gérez vos zones géographiques, regroupez vos points de vente par espace et visualisez les liens.
          </p>
        </div>
        {user?.role === 'administrateur' && (
          <Button onClick={() => handleOpenModal()} className="gap-2 font-semibold">
            <Plus className="w-4 h-4" />
            Créer un Espace
          </Button>
        )}
      </div>

      {spaces.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
            <MapPin className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucun espace configuré</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Créez votre premier espace Wi-Fi pour commencer à organiser vos points de vente, tickets et collectes.
          </p>
          {user?.role === 'administrateur' && (
            <Button onClick={() => handleOpenModal()} variant="secondary" className="font-bold gap-2">
              <Plus className="w-4 h-4" /> Créer mon premier espace
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {spaces.map((space) => {
            const linkedPos = allPos.filter((p) => p.space_id === space.id);
            const unlinkedPos = allPos.filter((p) => !p.space_id);
            const isManaging = managePosSpaceId === space.id;

            return (
              <Card key={space.id} className="space-y-4 h-full">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
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
                  <Link
                    href={`/spaces/${space.id}`}
                    className="ml-auto text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Tableau de bord →
                  </Link>
                </div>

                {/* Linked POS list */}
                {linkedPos.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      POS liés à cet espace
                    </p>
                    <div className="space-y-1.5">
                      {linkedPos.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Store className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {p.nom}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">{p.ville}</p>
                            </div>
                          </div>
                          {user?.role === 'administrateur' && (
                            <button
                              type="button"
                              onClick={() => handleUnlinkPos(p.id)}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-500/10 rounded transition"
                              title="Détacher ce POS"
                            >
                              <Unlink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {user?.role === 'administrateur' && (
                  <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setManagePosSpaceId(isManaging ? null : space.id)}
                      className="gap-1 text-xs w-full justify-center"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      {isManaging ? 'Fermer la liste' : 'Rattacher un POS existant'}
                    </Button>

                    {isManaging && (
                      <div className="space-y-1.5 max-h-60 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-1 pb-1">
                          POS disponibles ({unlinkedPos.length})
                        </p>
                        {unlinkedPos.length === 0 ? (
                          <p className="text-xs text-slate-500 text-center py-4">
                            Tous les POS sont déjà rattachés à un espace.
                          </p>
                        ) : (
                          unlinkedPos.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {p.nom}
                                </p>
                                <p className="text-[10px] text-slate-500 truncate">{p.ville}</p>
                              </div>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleLinkPos(space.id, p.id)}
                                className="gap-1 text-[11px] py-1 px-2 h-7"
                              >
                                <Link2 className="w-3 h-3" /> Rattacher
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenModal(space)}
                        className="gap-1 text-xs"
                      >
                        <Edit className="w-3.5 h-3.5" /> Modifier
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(space.id)}
                        className="gap-1 text-xs text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Supprimer
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
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
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Statut
                  </label>
                  <select
                    value={statut}
                    onChange={(e) => setStatut(e.target.value as 'actif' | 'inactif' | 'suspendu')}
                    className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium"
                  >
                    <option value="actif">Actif</option>
                    <option value="inactif">Inactif</option>
                    <option value="suspendu">Suspendu</option>
                  </select>
                </div>
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
