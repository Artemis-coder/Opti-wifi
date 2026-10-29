'use client';

import React, { useState } from 'react';
import { Camera, Check, Copy, MessageCircle, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';
import { whatsappFromNumber, whatsappHref } from '@/lib/whatsapp';

export interface PublicPaymentMethod {
  id: string;
  /** Opérateur (ex. Wave) */
  name: string;
  /** Numéro de paiement, à copier */
  account_number: string;
  /** Titulaire du compte */
  account_name: string | null;
  /** Lien WhatsApp pour le justificatif ; vide = wa.me/<numéro de paiement> */
  whatsapp_url: string | null;
  /** Instructions de paiement */
  description: string | null;
  /** QR code de paiement d'OptiWifi (data URL) */
  logo: string | null;
  /** Logo de l'opérateur (data URL) */
  brand_logo: string | null;
  /** Couleur de l'affiche (#rrggbb) */
  brand_color: string | null;
}

/** Bleu Wave, utilisé si aucune couleur n'est renseignée */
export const DEFAULT_BRAND_COLOR = '#1dc3ff';

/**
 * Affiche « Payez avec <opérateur> » sur le modèle de l'affiche Wave :
 * fond de la couleur de l'opérateur, logo, QR code d'OptiWifi dans un cadre blanc, consigne de scan.
 */
export function PaymentPoster({ method, className }: { method: PublicPaymentMethod; className?: string }) {
  return (
    <div
      className={cn('rounded-3xl px-5 pt-6 pb-7 sm:px-7 text-white space-y-6 shadow-sm', className)}
      style={{ background: method.brand_color || DEFAULT_BRAND_COLOR }}
    >
      <div className="flex items-center justify-center gap-3">
        {method.brand_logo && (
          // Data URL stockée en base : next/image n'apporte rien ici
          // eslint-disable-next-line @next/next/no-img-element
          <img src={method.brand_logo} alt="" className="h-16 sm:h-20 w-auto shrink-0 object-contain" />
        )}
        <p className="font-extrabold leading-none tracking-tight drop-shadow-sm">
          <span className="block text-2xl">Payez</span>
          <span className="block text-[2.5rem] leading-none whitespace-nowrap">avec {method.name}</span>
        </p>
      </div>

      <div className="mx-auto w-full max-w-[17rem] aspect-square rounded-2xl bg-white p-3 sm:p-4">
        {method.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={method.logo} alt={`QR code de paiement ${method.name}`} className="w-full h-full object-contain" />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-slate-300">
            <QrCode className="w-1/2 h-1/2" />
          </span>
        )}
      </div>

      <p className="flex items-start justify-center gap-2.5 text-xl sm:text-2xl font-extrabold leading-tight drop-shadow-sm">
        <Camera className="w-6 h-6 mt-0.5 shrink-0" />
        <span>Scanner le QR code pour payer</span>
      </p>
    </div>
  );
}

/** Miniature du QR code (liste du back-office). */
export function PaymentQrThumb({ method }: { method: Pick<PublicPaymentMethod, 'logo' | 'name' | 'brand_color'> }) {
  return (
    <span className="w-16 h-16 shrink-0 rounded-xl p-1.5" style={{ background: method.brand_color || DEFAULT_BRAND_COLOR }}>
      <span className="w-full h-full rounded-lg bg-white p-1 flex items-center justify-center">
        {method.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={method.logo} alt={`QR code ${method.name}`} className="w-full h-full object-contain" />
        ) : (
          <QrCode className="w-6 h-6 text-slate-300" />
        )}
      </span>
    </span>
  );
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Numéro copié');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copie impossible : notez le numéro');
    }
  };
  return { copied, copy };
}

/** Numéro de paiement à copier (alternative au scan). */
export function PayNumber({ method }: { method: PublicPaymentMethod }) {
  const { copied, copy } = useCopy();
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5">
      <div className="min-w-0">
        <p className="font-mono text-lg font-bold text-slate-900 dark:text-white tracking-wide break-all">{method.account_number}</p>
        {method.account_name && <p className="text-xs text-slate-500">Au nom de {method.account_name}</p>}
      </div>
      <button
        type="button"
        onClick={() => copy(method.account_number)}
        className="shrink-0 inline-flex items-center gap-1.5 h-11 px-4 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        {copied ? 'Copié' : 'Copier'}
      </button>
    </div>
  );
}

/** Envoi du justificatif de paiement : un seul bouton qui ouvre la conversation WhatsApp. */
export function WhatsappReceiptButton({ method, message }: { method: PublicPaymentMethod; message: string }) {
  const href = whatsappHref(method.whatsapp_url || whatsappFromNumber(method.account_number), message);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Envoyer le justificatif de paiement sur WhatsApp"
      className="w-full inline-flex items-center justify-center gap-2 min-h-12 px-4 py-2 rounded-xl text-base font-semibold text-white bg-[#128C7E] hover:bg-[#0e7268] active:scale-[0.99] transition touch-manipulation"
    >
      <MessageCircle className="w-5 h-5 shrink-0" /> Envoyer sur WhatsApp
    </a>
  );
}

/** Aperçu du back-office : ce que voit le client. */
export function PaymentMethodPreview({ method }: { method: PublicPaymentMethod }) {
  return (
    <div className="space-y-3">
      <PaymentPoster method={method} />
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-slate-500">Ou copiez le numéro {method.name}</p>
        <PayNumber method={method} />
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-slate-500">Après le paiement</p>
        <WhatsappReceiptButton method={method} message={`Bonjour, voici le justificatif de mon paiement ${method.name} pour mon abonnement OptiWifi.`} />
      </div>
    </div>
  );
}
