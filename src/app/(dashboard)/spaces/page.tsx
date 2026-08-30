'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, MapPin, Loader2, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores/authStore';
import { WifiSpace } from '@/types/database';

export default function WifiSpacesPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [spaces, setSpaces] = useState<WifiSpace[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSpace, setEditingSpace] = useState<WifiSpace | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [adresse, setAdresse] = useState('');
  const [ville, setVille] = useState('');
  const [statut, setStatut] = useState<'actif' | 'inactif' | 'suspendu'>('actif');

  const supabase = createClient();

  useEffect(() => {
    async function loadSpaces() {
      setLoading(true);
      const { data } = await supabase.from('wifi_spaces').select('*').order('created_at', { ascending: false });
      setSpaces(data || []);
      setLoading(false);
    }
    loadSpaces();
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
    const { error } = await supabase.from('wifi_spaces').delete().eq('id', id);
    if (error) {
      toast.error('Erreur lors de la suppression de l\'espace');
    } else {
      toast.success('Espace supprimé avec succès');
      setSpaces((prev) => prev.filter((s) => s.id !== id));
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
          <p className="text-xs text-slate-500">Gérez vos zones géographiques et regroupez vos points de vente par espace.</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {spaces.map((space) => (
            <Card key={space.id} className="space-y-4 h-full">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">{space.nom}</h3>
                  <p className="text-xs text-slate-500 mt-1">{space.description || 'Aucune description'}</p>
                </div>
                <Badge variant={space.statut === 'actif' ? 'success' : space.statut === 'suspendu' ? 'danger' : 'neutral'}>
                  {space.statut}
                </Badge>
              </div>

              <div className="space-y-1 text-xs text-slate-500">
                {space.adresse && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{space.adresse}</span>
                  </div>
                )}
                {space.ville && <span>{space.ville}</span>}
              </div>

              {user?.role === 'administrateur' && (
                <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <Button variant="ghost" size="sm" onClick={() => handleOpenModal(space)} className="gap-1 text-xs">
                    <Edit className="w-3.5 h-3.5" /> Modifier
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(space.id)} className="gap-1 text-xs text-red-600 hover:text-red-700">
                    <Trash2 className="w-3.5 h-3.5" /> Supprimer
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingSpace ? 'Modifier l\'Espace' : 'Créer un Espace Wi-Fi'}
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
