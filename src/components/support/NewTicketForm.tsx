'use client';

import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CustomSelect, type SelectOption } from '@/components/ui/CustomSelect';
import { CATEGORY_OPTIONS, PRIORITY_OPTIONS } from '@/components/support/labels';

interface NewTicketFormProps {
  endpoint: string;
  /** Back-office : choix du client concerné et de la priorité */
  clients?: SelectOption[];
  onCreated: (id: string) => void;
  onCancel: () => void;
}

/** Formulaire d'ouverture de ticket (client ou support). */
export function NewTicketForm({ endpoint, clients, onCreated, onCancel }: NewTicketFormProps) {
  const [organizationId, setOrganizationId] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('technical');
  const [priority, setPriority] = useState('normal');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const forSupport = !!clients;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forSupport && !organizationId) {
      toast.error('Choisissez le client concerné');
      return;
    }
    setSending(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, category, message, ...(forSupport ? { organizationId, priority } : {}) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error);
      toast.success(`Ticket ${json.data.ticket_number} ${forSupport ? 'ouvert pour le client' : 'envoyé au support'}`);
      onCreated(json.data.id);
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Échec de l'envoi du ticket");
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {forSupport && (
        <CustomSelect
          label="Client concerné *"
          value={organizationId}
          onChange={setOrganizationId}
          options={clients}
          placeholder="Choisir un client"
          searchPlaceholder="Rechercher un client…"
        />
      )}
      <Input
        label="Sujet *"
        placeholder="ex : Impossible d'enregistrer une collecte"
        value={subject}
        maxLength={200}
        onChange={(e) => setSubject(e.target.value)}
        required
      />
      <div className={forSupport ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : ''}>
        <CustomSelect label="Catégorie" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} searchable={false} />
        {forSupport && (
          <CustomSelect label="Priorité" value={priority} onChange={setPriority} options={PRIORITY_OPTIONS} searchable={false} />
        )}
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor="ticket-message"
          className="block text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider"
        >
          Message *
        </label>
        <textarea
          id="ticket-message"
          rows={5}
          maxLength={5000}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            forSupport
              ? 'Message adressé au client…'
              : 'Décrivez votre problème : ce que vous faisiez, ce qui s’est passé, le message d’erreur…'
          }
          className="w-full px-4 sm:px-3.5 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" icon={Send} isLoading={sending} className="font-semibold">
          {forSupport ? 'Ouvrir le ticket' : 'Envoyer au support'}
        </Button>
      </div>
    </form>
  );
}
