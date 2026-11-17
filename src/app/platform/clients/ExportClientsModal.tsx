'use client';

import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  CLIENT_STATUS_LABELS,
  OFFER_STATUS_LABELS,
  type ClientStatus,
  type OfferStatus,
} from '@/lib/platform-client-status';

type Plan = { id: string; name: string };

const CLIENT_CHOICES: ClientStatus[] = ['active', 'pending', 'suspended', 'refused', 'deleted'];
const OFFER_CHOICES: OfferStatus[] = ['active', 'trial', 'expiring', 'expired', 'unpaid', 'suspended', 'cancelled', 'none'];

/** Choix sous forme de filtre (même gabarit que les filtres de la page). */
function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition whitespace-nowrap ${
        active ? 'bg-accent text-accent-foreground' : 'bg-default text-muted hover:bg-default-hover hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-semibold text-foreground">{title}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/**
 * Export des clients (CSV ou Excel) : contacts seuls (client, responsable, téléphone, email)
 * pour une plateforme d'envoi de SMS, ou fiche complète ; filtrable par statut du client,
 * statut de l'offre et offre. Pré-rempli avec les filtres de la liste.
 */
export function ExportClientsModal({
  isOpen,
  onClose,
  initialClient,
  initialOffer,
  search,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialClient: string;
  initialOffer: string;
  search: string;
}) {
  const [content, setContent] = useState<'contacts' | 'full'>('contacts');
  const [format, setFormat] = useState<'csv' | 'xlsx'>('csv');
  const [clients, setClients] = useState<ClientStatus[]>([]);
  const [offers, setOffers] = useState<OfferStatus[]>([]);
  const [plans, setPlans] = useState<string[]>([]);
  const [withPhone, setWithPhone] = useState(true);
  const [withEmail, setWithEmail] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [planList, setPlanList] = useState<Plan[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);

  // À l'ouverture : reprend les filtres de la liste
  const [wasOpen, setWasOpen] = useState(false);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setClients(initialClient !== 'all' ? [initialClient as ClientStatus] : []);
      setOffers(initialOffer !== 'all' ? [initialOffer as OfferStatus] : []);
      setUseSearch(!!search.trim());
    }
  }

  useEffect(() => {
    if (!isOpen || planList.length) return;
    fetch('/api/platform/plans')
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((r) => setPlanList((r.data || []).map((p: Plan) => ({ id: p.id, name: p.name }))))
      .catch(() => {});
  }, [isOpen, planList.length]);

  const params = new URLSearchParams({
    format,
    content,
    clients: clients.join(','),
    offers: offers.join(','),
    plans: plans.join(','),
    withPhone: withPhone ? '1' : '0',
    withEmail: withEmail ? '1' : '0',
    search: useSearch ? search.trim() : '',
  });
  // Le nombre ne dépend pas du format ni du contenu
  const countKey = [clients, offers, plans, withPhone, withEmail, useSearch ? search : ''].join('|');

  useEffect(() => {
    if (!isOpen) return;
    const p = new URLSearchParams(params);
    p.set('preview', '1');
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/platform/clients/export?${p}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((r) => setCount(r ? r.count : null))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, countKey]);

  const download = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/platform/clients/export?${params}`);
      if (!res.ok) {
        toast.error("L'export a échoué. Réessayez.");
        return;
      }
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || `clients.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`${count ?? ''} client${count === 1 ? '' : 's'} exporté${count === 1 ? '' : 's'}.`.trim());
      onClose();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Exporter les clients">
      <div className="space-y-4">
        <Section title="Contenu">
          <Choice active={content === 'contacts'} onClick={() => setContent('contacts')}>
            Contacts uniquement
          </Choice>
          <Choice active={content === 'full'} onClick={() => setContent('full')}>
            Fiche complète
          </Choice>
        </Section>
        <p className="text-xs text-muted -mt-2">
          {content === 'contacts'
            ? 'Client, responsable, téléphone et email : prêt pour une plateforme d’envoi de SMS.'
            : 'Contacts, statut, offre, statut de l’offre, expiration, pays et date de création.'}
        </p>

        <Section title="Format">
          <Choice active={format === 'csv'} onClick={() => setFormat('csv')}>
            CSV
          </Choice>
          <Choice active={format === 'xlsx'} onClick={() => setFormat('xlsx')}>
            Excel (.xlsx)
          </Choice>
        </Section>

        <Section title="Statut du client" hint="Aucun choix : tous les clients, sauf les supprimés.">
          {CLIENT_CHOICES.map((s) => (
            <Choice key={s} active={clients.includes(s)} onClick={() => setClients(toggle(clients, s))}>
              {CLIENT_STATUS_LABELS[s]}
            </Choice>
          ))}
        </Section>

        <Section title="Statut de l'offre" hint="Aucun choix : tous.">
          {OFFER_CHOICES.map((s) => (
            <Choice key={s} active={offers.includes(s)} onClick={() => setOffers(toggle(offers, s))}>
              {OFFER_STATUS_LABELS[s]}
            </Choice>
          ))}
        </Section>

        <Section title="Offre" hint="Aucun choix : toutes les offres.">
          {planList.map((p) => (
            <Choice key={p.id} active={plans.includes(p.id)} onClick={() => setPlans(toggle(plans, p.id))}>
              {p.name}
            </Choice>
          ))}
          <Choice active={plans.includes('none')} onClick={() => setPlans(toggle(plans, 'none'))}>
            Sans offre
          </Choice>
        </Section>

        <Section title="Uniquement les clients">
          <Choice active={withPhone} onClick={() => setWithPhone(!withPhone)}>
            Avec un téléphone
          </Choice>
          <Choice active={withEmail} onClick={() => setWithEmail(!withEmail)}>
            Avec un email
          </Choice>
          {!!search.trim() && (
            <Choice active={useSearch} onClick={() => setUseSearch(!useSearch)}>
              Correspondant à « {search.trim().slice(0, 30)} »
            </Choice>
          )}
        </Section>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end pt-1">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button icon={Download} onClick={download} isLoading={downloading} disabled={count === 0}>
            {count === null ? 'Exporter' : `Exporter ${count} client${count === 1 ? '' : 's'}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
