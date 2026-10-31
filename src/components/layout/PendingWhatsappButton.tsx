'use client';

import React, { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { whatsappHref } from '@/lib/whatsapp';

interface SupportContact {
  whatsapp_url: string | null;
  name: string | null;
  email: string | null;
  organization_name: string | null;
}

/**
 * Compte en attente de validation : bouton WhatsApp vers le support, message prérempli
 * (entreprise, nom, e-mail) pour demander l'activation du compte.
 */
export function PendingWhatsappButton() {
  const [contact, setContact] = useState<SupportContact | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/account/support-contact')
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (!cancelled && res?.data) setContact(res.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!contact?.whatsapp_url) return null;

  const message = [
    "Bonjour l'équipe OptiSpace,",
    `je viens de créer mon compte${contact.organization_name ? ` pour l'entreprise « ${contact.organization_name} »` : ''}.`,
    "Pourriez-vous valider mon inscription afin que je puisse commencer à utiliser l'outil ?",
    [contact.name && `Nom : ${contact.name}`, contact.email && `E-mail : ${contact.email}`].filter(Boolean).join(' · '),
    'Merci !',
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <a
      href={whatsappHref(contact.whatsapp_url, message)}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-[#128C7E] hover:bg-[#0e7268] transition"
    >
      <MessageCircle className="w-4 h-4" />
      Demander l&apos;activation sur WhatsApp
    </a>
  );
}
