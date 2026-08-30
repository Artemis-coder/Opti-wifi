'use client';

import React, { useState, useEffect } from 'react';
import { Ticket, Plus, Clock, Loader2, Edit, PauseCircle, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { EditTicketModal } from './edit-ticket-modal';
import { formatCurrencyFCFA } from '@/lib/utils/format';
import { TicketType } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { useSpaceStore } from '@/lib/stores/spaceStore';

export default function TicketTypesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [tickets, setTickets] = useState<TicketType[]>([]);

  const [nom, setNom] = useState('');
  const [duree, setDuree] = useState('24');
  const [prix, setPrix] = useState('1000');

  const supabase = createClient();
  const { currentSpaceId } = useSpaceStore();

  const [editingTicket, setEditingTicket] = useState<TicketType | null>(null);

  useEffect(() => {
    async function loadTickets() {
      setLoading(true);
      let query = supabase.from('ticket_types').select('*').order('prix', { ascending: true });
      if (currentSpaceId) {
        query = query.eq('space_id', currentSpaceId);
      }
      const { data } = await query;
      setTickets(data || []);
      setLoading(false);
    }
    loadTickets();
  }, [currentSpaceId, supabase]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom || !prix) return;

    setCreating(true);

    const newTicketData = {
      nom,
      duree_heures: parseInt(duree) || 24,
      prix: parseFloat(prix) || 500,
      actif: true,
    };

    const { data, error } = await supabase
      .from('ticket_types')
      .insert(newTicketData)
      .select('*')
      .single();

    if (!error && data) {
      setTickets([...tickets, data]);
      toast.success('Type de ticket créé.');
    } else if (error) {
      toast.error(`Erreur: ${error.message}`);
    }

    setNom('');
    setCreating(false);
    setIsModalOpen(false);
  };

  const handleToggleActif = async (ticket: TicketType) => {
    const newActif = !ticket.actif;
    const { error } = await supabase
      .from('ticket_types')
      .update({ actif: newActif })
      .eq('id', ticket.id);

    if (error) {
      toast.error(`Erreur: ${error.message}`);
    } else {
      toast.success(newActif ? 'Ticket activé.' : 'Ticket désactivé.');
      setTickets(tickets.map((t) => t.id === ticket.id ? { ...t, actif: newActif } : t));
    }
  };

  const handleTicketUpdated = (updated: TicketType) => {
    setTickets(tickets.map((t) => (t.id === updated.id ? updated : t)));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Types de Tickets Wi-Fi</h1>
          <p className="text-xs text-slate-500">Configurez les forfaits et la grille tarifaire de vos tickets.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2 font-semibold">
          <Plus className="w-4 h-4" />
          Nouveau Type de Ticket
        </Button>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          Chargement des forfaits...
        </div>
      ) : tickets.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
            <Ticket className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucun type de ticket</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Créez votre premier forfait (ex: Pass 1h, Pass 24h) pour commencer la distribution.
          </p>
          <Button onClick={() => setIsModalOpen(true)} variant="secondary" className="font-bold gap-2">
            <Plus className="w-4 h-4" /> Créer un premier ticket
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tickets.map((t) => (
            <Card key={t.id} className="space-y-4 hover:border-emerald-500/50 transition">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    <Ticket className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">{t.nom}</h3>
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>Durée : {t.duree_heures} heure(s)</span>
                    </div>
                  </div>
                </div>
                <Badge variant={t.actif ? 'success' : 'neutral'}>
                  {t.actif ? 'Actif' : 'Inactif'}
                </Badge>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Prix public :</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-extrabold text-[#0b1a3a] dark:text-amber-400">
                    {formatCurrencyFCFA(t.prix)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-1.5 h-7 w-7"
                    onClick={() => setEditingTicket(t)}
                    title="Modifier"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-1.5 h-7 w-7"
                    onClick={() => handleToggleActif(t)}
                    title={t.actif ? 'Désactiver' : 'Activer'}
                  >
                    {t.actif ? (
                      <PauseCircle className="w-3.5 h-3.5 text-slate-600" />
                    ) : (
                      <PlayCircle className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Créer un Type de Ticket">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Nom du Pass" placeholder="ex: Pass 12h Découverte" value={nom} onChange={(e) => setNom(e.target.value)} required />
          <Input label="Durée (en heures)" type="number" placeholder="12" value={duree} onChange={(e) => setDuree(e.target.value)} required />
          <Input label="Prix Vente (FCFA)" type="number" placeholder="500" value={prix} onChange={(e) => setPrix(e.target.value)} required />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Annuler</Button>
            <Button type="submit" isLoading={creating}>Enregistrer Ticket</Button>
          </div>
        </form>
      </Modal>

      <EditTicketModal
        key={`edit-ticket-${editingTicket?.id || 'null'}`}
        isOpen={!!editingTicket}
        onClose={() => setEditingTicket(null)}
        ticket={editingTicket}
        onSuccess={handleTicketUpdated}
      />
    </div>
  );
}
