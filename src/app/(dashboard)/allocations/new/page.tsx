'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeftRight, CheckCircle2, Loader2, AlertCircle, Plus, Trash2, Receipt } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';
import { formatCurrencyFCFA } from '@/lib/utils/format';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PointOfSale, TicketType } from '@/types/database';

interface AllocationLine {
  ticketTypeId: string;
  quantite: number;
}

export default function NewAllocationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [posList, setPosList] = useState<PointOfSale[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);

  const [posId, setPosId] = useState('');
  const [dateAllocation, setDateAllocation] = useState(() => new Date().toISOString().split('T')[0]);
  const [lines, setLines] = useState<AllocationLine[]>([{ ticketTypeId: '', quantite: 0 }]);
  const [notes, setNotes] = useState('');

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const [posRes, ticketRes] = await Promise.all([
        supabase.from('points_of_sale').select('*').order('nom'),
        supabase.from('ticket_types').select('*').order('nom'),
      ]);

      if (posRes.data && posRes.data.length > 0) {
        setPosList(posRes.data);
        setPosId(posRes.data[0].id);
      } else {
        setPosList([]);
      }

      if (ticketRes.data && ticketRes.data.length > 0) {
        setTicketTypes(ticketRes.data);
        setLines((prev) => prev.map((l, i) => (i === 0 ? { ...l, ticketTypeId: ticketRes.data![0].id } : l)));
      } else {
        setTicketTypes([]);
      }
      setLoading(false);
    }

    loadData();
  }, [supabase]);

  const selectedPos = posList.find((p) => p.id === posId);

const addLine = () => {
    setLines([...lines, { ticketTypeId: ticketTypes[0]?.id || '', quantite: 0 }]);
  };
  
  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };
  
  const updateLine = (index: number, field: keyof AllocationLine, value: string | number) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    setLines(updated);
  };
  
  const totalTickets = lines.reduce((sum, l) => sum + (l.quantite || 0), 0);
  
  const totalMontant = lines.reduce((sum, l) => {
    const ticket = ticketTypes.find((t) => t.id === l.ticketTypeId);
    return sum + (ticket ? ticket.prix * (l.quantite || 0) : 0);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!posId) {
      toast.error('Veuillez sélectionner un point de vente.');
      return;
    }

    const validLines = lines.filter((l) => l.ticketTypeId && l.quantite > 0);
    if (validLines.length === 0) {
      toast.error('Veuillez sélectionner au moins un type de ticket avec une quantité supérieure à 0.');
      return;
    }

    setSubmitting(true);

    const itemsToInsert = validLines.map((l) => ({
      pos_id: posId,
      ticket_type_id: l.ticketTypeId,
      quantite: l.quantite,
      notes,
      space_id: selectedPos?.space_id || null,
      date_allocation: dateAllocation || new Date().toISOString().split('T')[0],
    }));

    const { error } = await supabase.from('ticket_allocations').insert(itemsToInsert);

    if (error) {
      toast.error(`Erreur: ${error.message}`);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setSubmitted(true);
    toast.success('Allocation enregistrée avec succès');
    setTimeout(() => {
      router.push('/allocations');
    }, 1200);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ArrowLeftRight className="w-6 h-6 text-amber-500" />
          Allocation de Tickets aux Points de Vente
        </h1>
        <p className="text-xs text-slate-500">Distribuez du stock de tickets à un point de vente de votre réseau.</p>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          Chargement des références...
        </div>
      ) : posList.length === 0 || ticketTypes.length === 0 ? (
        <Card className="p-8 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Référentiel incomplet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Pour effectuer une allocation de stock, vous devez d&apos;abord avoir configuré au moins un <strong>Point de Vente</strong> et un <strong>Type de Ticket</strong>.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            {posList.length === 0 && (
              <Link href="/pos">
                <Button size="sm" variant="secondary" className="gap-2 font-bold">
                  <Plus className="w-4 h-4" /> Créer un POS
                </Button>
              </Link>
            )}
            {ticketTypes.length === 0 && (
              <Link href="/tickets">
                <Button size="sm" className="gap-2 font-bold">
                  <Plus className="w-4 h-4" /> Créer un Ticket
                </Button>
              </Link>
            )}
          </div>
        </Card>
      ) : submitted ? (
        <Card className="p-8 text-center space-y-3 border-emerald-500">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Allocation Enregistrée !</h3>
          <p className="text-xs text-slate-500">Le stock du point de vente a été mis à jour instantanément dans la base de données.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
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
                    <option key={p.id} value={p.id}>{p.nom} ({p.ville})</option>
                  ))}
                 </select>
               </div>

               <div className="space-y-1.5">
                 <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                   Date d&apos;Allocation
                 </label>
                 <Input
                   type="date"
                   value={dateAllocation}
                   onChange={(e) => setDateAllocation(e.target.value)}
                 />
               </div>

               <div className="space-y-3">
                 <div className="flex items-center justify-between">
                   <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                     Tickets à Allouer
                   </label>
                  <Button type="button" size="sm" variant="ghost" onClick={addLine} className="gap-1 text-xs">
                    <Plus className="w-4 h-4" /> Ajouter un type
                  </Button>
                </div>

                {lines.map((line, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex-1 space-y-2">
                      <select
                        value={line.ticketTypeId}
                        onChange={(e) => updateLine(index, 'ticketTypeId', e.target.value)}
                        className="w-full h-9 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium"
                      >
                        {ticketTypes.map((t) => (
                          <option key={t.id} value={t.id}>{t.nom} — {formatCurrencyFCFA(t.prix)}</option>
                        ))}
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          label="Quantité allouée"
                          type="number"
                          min="1"
                          value={line.quantite || ''}
                          onChange={(e) => updateLine(index, 'quantite', parseInt(e.target.value) || 0)}
                          placeholder="0"
                        />
                        <div className="flex items-end">
                          <p className="text-[11px] text-slate-500 pb-2">Quantité en gris = information récapitulative</p>
                        </div>
                      </div>
                    </div>
                    {lines.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLine(index)}
                        className="text-red-600 hover:text-red-700 mt-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <Input
                label="Notes / Référence de livraison"
                placeholder="ex: Reçu bordereau N° 4589"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              <div className="pt-2 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => router.back()}>Annuler</Button>
                <Button type="submit" variant="secondary" className="px-6 font-bold" isLoading={submitting}>
                  Valider l&apos;Allocation
                </Button>
              </div>
            </form>
          </Card>

          <Card className="h-fit">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Récapitulatif de l&apos;Allocation</h3>
              </div>

              <div className="space-y-3">
                 <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl">
                   <p className="text-[11px] text-slate-500 font-semibold uppercase">Point de Vente</p>
                   <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedPos?.nom || '—'}</p>
                   <p className="text-xs text-slate-500">{selectedPos?.ville || ''}</p>
                 </div>

                 <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl">
                   <p className="text-[11px] text-slate-500 font-semibold uppercase">Date d&apos;Allocation</p>
                   <p className="text-sm font-bold text-slate-900 dark:text-white">{dateAllocation}</p>
                 </div>

                 <div className="space-y-2">
                  <p className="text-[11px] text-slate-500 font-semibold uppercase">Détail par Ticket</p>
                  {lines.map((line, index) => {
                    const ticket = ticketTypes.find((t) => t.id === line.ticketTypeId);
                    if (!ticket) return null;
                    return (
                      <div key={index} className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{ticket.nom}</p>
                          <p className="text-[11px] text-slate-500">{formatCurrencyFCFA(ticket.prix)} / unité</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-extrabold text-slate-900 dark:text-white">{line.quantite || 0}</p>
                          <p className="text-[10px] text-slate-500">alloué(s)</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Total Tickets</span>
                    <span className="text-lg font-extrabold text-amber-600">{totalTickets}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Montant Total</span>
                    <span className="text-lg font-extrabold text-slate-900 dark:text-white">{formatCurrencyFCFA(totalMontant)}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
