'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PointOfSale, Profile, PosStatus, WifiSpace } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { useSpaceStore } from '@/lib/stores/spaceStore';

interface EditPosModalProps {
  isOpen: boolean;
  onClose: () => void;
  pos: PointOfSale | null;
  collectors: Profile[];
  spaces: WifiSpace[];
  onSuccess: (updated: PointOfSale) => void;
}

export function EditPosModal({ isOpen, onClose, pos, collectors, spaces, onSuccess }: EditPosModalProps) {
  const { currentSpaceId } = useSpaceStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nom, setNom] = useState(pos?.nom || '');
  const [adresse, setAdresse] = useState(pos?.adresse || '');
  const [ville, setVille] = useState(pos?.ville || 'Abidjan');
  const [collecteurId, setCollecteurId] = useState(pos?.collecteur_id || '');
  const [spaceId, setSpaceId] = useState(pos?.space_id || currentSpaceId || '');
  const [statut, setStatut] = useState<PosStatus>(pos?.statut || 'actif');

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) {
      toast.error('Le nom du POS est requis.');
      return;
    }

    setIsSubmitting(true);

    const payload = {
      nom: nom.trim(),
      adresse: adresse.trim() || null,
      ville: ville.trim(),
      collecteur_id: collecteurId || null,
      space_id: spaceId || null,
      statut,
      updated_at: new Date().toISOString(),
    };

    let result: PointOfSale | null = null;
    let error: unknown = null;

    if (pos) {
      const res = await supabase
        .from('points_of_sale')
        .update(payload)
        .eq('id', pos.id)
        .select('*, collecteur:profiles(*)')
        .single();
      result = res.data;
      error = res.error;
    } else {
      const res = await supabase
        .from('points_of_sale')
        .insert({ ...payload, statut: 'actif' } as PointOfSale)
        .select('*, collecteur:profiles(*)')
        .single();
      result = res.data;
      error = res.error;
    }

    if (error || !result) {
      toast.error(`Erreur: ${(error as { message?: string })?.message || 'Échec de lenregistrement.'}`);
    } else {
      toast.success(pos ? 'Point de vente modifié.' : 'Point de vente créé.');
      onSuccess(result);
      onClose();
    }

    setIsSubmitting(false);
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={pos ? 'Modifier le Point de Vente' : 'Créer un Point de Vente'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nom du POS"
          placeholder="ex: POS Cocody St Jean"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          required
        />
        <Input
          label="Adresse / Emplacement"
          placeholder="ex: Rue des Jardins"
          value={adresse}
          onChange={(e) => setAdresse(e.target.value)}
        />
        <Input
          label="Ville"
          placeholder="Abidjan"
          value={ville}
          onChange={(e) => setVille(e.target.value)}
          required
        />

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Espace Wi-Fi
          </label>
          <select
            value={spaceId}
            onChange={(e) => setSpaceId(e.target.value)}
            className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
          >
            <option value="">Aucun espace</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nom}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Collecteur Attribué (Optionnel)
          </label>
          <select
            value={collecteurId}
            onChange={(e) => setCollecteurId(e.target.value)}
            className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
          >
            <option value="">Aucun collecteur attribué</option>
            {collectors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom} ({c.email})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Statut
          </label>
          <select
            value={statut}
            onChange={(e) => setStatut(e.target.value as PosStatus)}
            className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
          >
            <option value="actif">Actif</option>
            <option value="inactif">Inactif</option>
            <option value="suspendu">Suspendu</option>
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {pos ? 'Mettre à jour' : 'Créer le POS'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
