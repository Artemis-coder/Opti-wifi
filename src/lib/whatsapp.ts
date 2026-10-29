// Liens WhatsApp des moyens de paiement (partagé serveur / navigateur : aucun import serveur ici).

const WHATSAPP_HOSTS = new Set(['wa.me', 'api.whatsapp.com', 'whatsapp.com', 'www.whatsapp.com', 'chat.whatsapp.com']);

/**
 * Valide et normalise le lien saisi au back-office.
 * - Lien WhatsApp (wa.me/…, api.whatsapp.com/…, whatsapp.com/…) : accepté, forcé en https.
 * - Simple numéro (ex. +225 07 00 00 00 00) : converti en https://wa.me/2250700000000.
 * - Tout autre lien : refusé (évite de renvoyer les clients vers un site tiers).
 * Renvoie null si vide, false si invalide.
 */
export function normalizeWhatsappUrl(input: string): string | null | false {
  const value = input.trim();
  if (!value) return null;

  if (/^\+?[\d\s().-]{8,20}$/.test(value)) {
    const digits = value.replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15 ? `https://wa.me/${digits}` : false;
  }

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return false;
  }
  if (!WHATSAPP_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password) return false;
  url.protocol = 'https:';
  const normalized = url.toString();
  return normalized.length <= 300 ? normalized : false;
}

/**
 * Lien à ouvrir côté client : ajoute le message prérempli quand le lien le permet
 * (wa.me/<numéro> ou api.whatsapp.com/send?phone=…, sans texte déjà défini).
 * Les liens courts WhatsApp Business (wa.me/message/…) gardent leur propre message.
 */
export function whatsappHref(link: string, message: string): string {
  try {
    const url = new URL(link);
    const host = url.hostname.toLowerCase();
    const isNumberLink = host === 'wa.me' && /^\/\d{8,15}\/?$/.test(url.pathname);
    const isSendLink = host.endsWith('whatsapp.com') && url.pathname.startsWith('/send') && url.searchParams.has('phone');
    if (!(isNumberLink || isSendLink) || url.searchParams.has('text')) return url.toString();
    // encodeURIComponent : espaces en %20 (WhatsApp n'interprète pas toujours « + »)
    return `${url.toString()}${url.search ? '&' : '?'}text=${encodeURIComponent(message)}`;
  } catch {
    return link;
  }
}

/** Lien WhatsApp par défaut : le numéro de paiement. */
export function whatsappFromNumber(number: string): string {
  return `https://wa.me/${number.replace(/\D/g, '')}`;
}
