'use client';

import React, { useState, useEffect } from 'react';
import { LifeBuoy, Loader2, Plus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';

interface SupportTicket {
  id: string;
  client_name: string;
  subject: string;
  status: 'new' | 'in_progress' | 'resolved' | 'closed';
  message: string;
  created_at: string;
}

export default function PlatformSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const statusConfig = {
    new: { label: 'Nouveau', color: 'info' as const },
    in_progress: { label: 'En cours', color: 'warning' as const },
    resolved: { label: 'Résolu', color: 'success' as const },
    closed: { label: 'Fermé', color: 'neutral' as const },
  };

  useEffect(() => {
    async function fetchTickets() {
      setLoading(true);
      try {
        const res = await fetch('/api/platform/support');
        const result = await res.json();
        if (res.ok && result.data) {
          setTickets(result.data);
        }
      } catch {
        toast.error('Erreur de chargement');
      } finally {
        setLoading(false);
      }
    }

    fetchTickets();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/platform/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message }),
      });
      const result = await res.json();
      if (res.ok && result.data) {
        setTickets([result.data, ...tickets]);
        setIsModalOpen(false);
        setSubject('');
        setMessage('');
        toast.success('Ticket créé');
      } else {
        toast.error(result.error || 'Erreur lors de la création');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
        <span>Chargement des tickets...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Support & Tickets</h1>
          <p className="text-xs text-slate-500">Suivez les problèmes signalés par les clients.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2 font-semibold">
          <Plus className="w-4 h-4" /> Nouveau ticket
        </Button>
      </div>

      {tickets.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <LifeBuoy className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucun ticket de support</h3>
          <p className="text-xs text-slate-500">Aucun problème n&apos;a été signalé pour le moment.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => {
            const config = statusConfig[t.status];
            return (
              <Card key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <LifeBuoy className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900 dark:text-white">{t.subject}</h3>
                        <Badge variant={config.color} className="text-xs">{config.label}</Badge>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{t.message}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Client: {t.client_name} Créé: {new Date(t.created_at).toLocaleString('fr-FR')}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <Card className="w-full max-w-lg fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Créer un ticket de support</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Sujet"
                placeholder="Description du problème..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
              <Input
                label="Message"
                placeholder="Détails du problème..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" variant="secondary" isLoading={submitting}>
                  Créer
                </Button>
              </div>
            </form>
          </div>
        </Card>
      )}
    </div>
  );
}
