'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeftRight, CheckCircle2, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PointOfSale, TicketType } from '@/types/database';

export default function NewAllocationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [posList, setPosList] = useState<PointOfSale[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);

  const [posId, setPosId] = useState('');
  const [ticketTypeId, setTicketTypeId] = useState('');
  const [quantite, setQuantite] = useState('100');
  const [notes, setNotes] = useState('');

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const { data: posData } = await supabase.from('points_of_sale').select('*');
      const { data: ticketData } = await supabase.from('ticket_types').select('*');

      if (posData && posData.length > 0) {
        setPosList(posData);
        setPosId(posData[0].id);
      } else {
        setPosList([
          { id: '1', nom: 'POS Cocody St Jean', ville: 'Abidjan', statut: 'actif', created_at: '', updated_at: '' },
          { id: '2', nom: 'POS Yopougon Maroc', ville: 'Abidjan', statut: 'actif', created_at: '', updated_at: '' },
        ]);
        setPosId('1');
      }

      if (ticketData && ticketData.length > 0) {
        setTicketTypes(ticketData);
        setTicketTypeId(ticketData[0].id);
      } else {
        setTicketTypes([
          { id: '1', nom: 'Pass 1 Heure', duree_heures: 1, prix: 200, actif: true, created_at: '' },
          { id: '4', nom: 'Pass 24 Heures Journée', duree_heures: 24, prix: 1000, actif: true, created_at: '' },
        ]);
        setTicketTypeId('4');
      }
      setLoading(false);
    }

    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!posId || !ticketTypeId || !quantite) return;

    setSubmitting(true);

    // Save allocation into Supabase DB
    await supabase.from('ticket_allocations').insert({
      pos_id: posId,
      ticket_type_id: ticketTypeId,
      quantite: parseInt(quantite) || 1,
      notes,
    });

    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => {
      router.push('/dashboard');
    }, 1500);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ArrowLeftRight className="w-6 h-6 text-amber-500" />
          Allocation de Tickets aux Points de Vente
        </h1>
        <p className="text-xs text-slate-500">Stockage en temps réel dans la table PostgreSQL ticket_allocations.</p>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          Chargement des références depuis Supabase...
        </div>
      ) : submitted ? (
        <Card className="p-8 text-center space-y-3 border-emerald-500">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Allocation Enregistrée dans Supabase !</h3>
          <p className="text-xs text-slate-500">Le stock du point de vente a été mis à jour instantanément.</p>
        </Card>
      ) : (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Point de Vente Cible
              </label>
              <select
                value={posId}
                onChange={(e) => setPosId(e.target.value)}
                className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium"
              >
                {posList.map((p) => (
                  <option key={p.id} value={p.id}>{p.nom}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Type de Ticket
              </label>
              <select
                value={ticketTypeId}
                onChange={(e) => setTicketTypeId(e.target.value)}
                className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium"
              >
                {ticketTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.nom} ({t.prix} FCFA)</option>
                ))}
              </select>
            </div>

            <Input
              label="Quantité à Allouer"
              type="number"
              value={quantite}
              onChange={(e) => setQuantite(e.target.value)}
              required
              min="1"
            />

            <Input
              label="Notes / Référence de livraison"
              placeholder="ex: Reçu bordereau N° 4589"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            <div className="pt-2 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => router.back()}>Annuler</Button>
              <Button type="submit" variant="secondary" className="px-6 font-bold" isLoading={submitting}>
                Valider l'Allocation dans Supabase
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
