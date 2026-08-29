'use client';

import React, { useState } from 'react';
import { Ticket, Plus, Clock, Banknote } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { formatCurrencyFCFA } from '@/lib/utils/format';
import { TicketType } from '@/types/database';

export default function TicketTypesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tickets, setTickets] = useState<TicketType[]>([
    { id: '1', nom: 'Pass 1 Heure', duree_heures: 1, prix: 200, actif: true, created_at: new Date().toISOString() },
    { id: '2', nom: 'Pass 2 Heures', duree_heures: 2, prix: 350, actif: true, created_at: new Date().toISOString() },
    { id: '3', nom: 'Pass 5 Heures', duree_heures: 5, prix: 500, actif: true, created_at: new Date().toISOString() },
    { id: '4', nom: 'Pass 24 Heures Journée', duree_heures: 24, prix: 1000, actif: true, created_at: new Date().toISOString() },
    { id: '5', nom: 'Pass 7 Jours Semaine', duree_heures: 168, prix: 4500, actif: true, created_at: new Date().toISOString() },
  ]);

  const [nom, setNom] = useState('');
  const [duree, setDuree] = useState('24');
  const [prix, setPrix] = useState('1000');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom || !prix) return;

    const newTicket: TicketType = {
      id: Date.now().toString(),
      nom,
      duree_heures: parseInt(duree) || 24,
      prix: parseFloat(prix) || 500,
      actif: true,
      created_at: new Date().toISOString(),
    };

    setTickets([...tickets, newTicket]);
    setNom('');
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Types de Tickets Wi-Fi</h1>
          <p className="text-xs text-slate-500">Configurez la grille tarifaire et les durées de validité des tickets.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Nouveau Type de Ticket
        </Button>
      </div>

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
              <span className="text-lg font-extrabold text-[#0b1a3a] dark:text-amber-400">
                {formatCurrencyFCFA(t.prix)}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Créer un Type de Ticket">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Nom du Pass" placeholder="ex: Pass 12h Découverte" value={nom} onChange={(e) => setNom(e.target.value)} required />
          <Input label="Durée (en heures)" type="number" placeholder="12" value={duree} onChange={(e) => setDuree(e.target.value)} required />
          <Input label="Prix Vente (FCFA)" type="number" placeholder="500" value={prix} onChange={(e) => setPrix(e.target.value)} required />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Annuler</Button>
            <Button type="submit">Enregistrer Ticket</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
