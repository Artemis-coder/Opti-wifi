'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TicketType } from '@/types/database';
import { createClient } from '@/lib/supabase/client';

interface EditTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: TicketType | null;
  onSuccess: (updated: TicketType) => void;
}

export function EditTicketModal({ isOpen, onClose, ticket, onSuccess }: EditTicketModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nom, setNom] = useState(ticket?.nom || '');
  const [duree, setDuree] = useState(ticket ? String(ticket.duree_heures) : '24');
  const [prix, setPrix] = useState(ticket ? String(ticket.prix) : '1000');
  const [actif, setActif] = useState(ticket?.actif ?? true);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim() || !prix) {
      toast.error('Veuillez remplir tous les champs requis.');
      return;
    }

    if (!ticket) return;

    setIsSubmitting(true);

    const payload = {
      nom: nom.trim(),
      duree_heures: parseInt(duree) || 24,
      prix: parseFloat(prix) || 500,
      actif,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('ticket_types')
      .update(payload)
      .eq('id', ticket.id)
      .select('*')
      .single();

    if (error || !data) {
      toast.error(`Erreur: ${(error as { message?: string })?.message || 'Échec de la modification.'}`);
    } else {
      toast.success('Type de ticket modifié.');
      onSuccess(data);
      onClose();
    }

    setIsSubmitting(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Modifier le Type de Ticket"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nom du Pass"
          placeholder="ex: Pass 12h Découverte"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          required
        />
        <Input
          label="Durée (en heures)"
          type="number"
          placeholder="12"
          value={duree}
          onChange={(e) => setDuree(e.target.value)}
          required
          min="1"
        />
        <Input
          label="Prix Vente (FCFA)"
          type="number"
          placeholder="500"
          value={prix}
          onChange={(e) => setPrix(e.target.value)}
          required
          min="0"
        />
        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Statut actif
          </label>
          <button
            type="button"
            role="switch"
            aria-checked={actif}
            onClick={() => setActif(!actif)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 ${
              actif ? 'bg-emerald-600' : 'bg-slate-400'
            }`}
          >
            <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white" />
            <span className={`absolute right-1 top-1 h-4 w-4 rounded-full bg-white transition ${
              actif ? 'opacity-0' : 'opacity-100'
            }`} />
          </button>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
