// Schéma du contenu du site vitrine : sans import serveur, utilisable dans le back-office.

/**
 * Contenu du site vitrine (branche `landing`, projet Vercel optispace-landing),
 * administré depuis le back-office : /platform/site.
 *
 * Une ligne de `site_content` par section (clé → JSON). Le site lit le tout via
 * l'API publique /api/public/site-content ; une section absente de la base
 * reprend les valeurs par défaut ci-dessous (identiques au site d'origine).
 */

export type SiteLinks = {
  /** Bouton « Essai gratuit » / « Créer mon espace » */
  signup_url: string;
  /** Bouton « Se connecter » */
  login_url: string;
  /** Lien WhatsApp affiché dans l'appel final (vide = masqué) */
  whatsapp_url: string;
};

export type SiteHero = {
  badge: string;
  title_line1: string;
  title_line2: string;
  subtitle: string;
  cta_primary: string;
  cta_secondary: string;
  trust: string[];
};

export const SITE_SECTION_KEYS = [
  'pains',
  'calculator',
  'how_it_works',
  'showcase',
  'field',
  'audience',
  'pricing',
  'faq',
  'final_cta',
] as const;
export type SiteSectionKey = (typeof SITE_SECTION_KEYS)[number];
export type SiteSections = Record<SiteSectionKey, boolean>;

export type SitePricing = {
  title: string;
  subtitle: string;
  /** Forfait mis en avant (id de subscription_plans), null = aucun */
  featured_plan_id: string | null;
  /** Forfaits actifs à ne pas afficher sur le site */
  hidden_plan_ids: string[];
};

export type SiteFaq = { items: { q: string; a: string }[] };

export type SiteFinalCta = {
  title: string;
  highlight: string;
  text: string;
  cta_label: string;
  note: string;
};

export type SiteSeo = { title: string; description: string };

export type SiteContent = {
  links: SiteLinks;
  hero: SiteHero;
  sections: SiteSections;
  pricing: SitePricing;
  faq: SiteFaq;
  final_cta: SiteFinalCta;
  seo: SiteSeo;
};
export type SiteContentKey = keyof SiteContent;
export const SITE_CONTENT_KEYS: SiteContentKey[] = ['links', 'hero', 'sections', 'pricing', 'faq', 'final_cta', 'seo'];

export const SITE_SECTION_LABELS: Record<SiteSectionKey, string> = {
  pains: '« Ça vous parle ? » (les problèmes)',
  calculator: 'Calculateur de fuites',
  how_it_works: 'Comment ça marche',
  showcase: "Les écrans de l'outil",
  field: 'Sur le terrain (mobile)',
  audience: 'Pour qui / Avant-après',
  pricing: 'Tarifs',
  faq: 'Questions fréquentes',
  final_cta: 'Appel final',
};

export const SITE_DEFAULTS: SiteContent = {
  links: {
    signup_url: 'https://www.optiwifi.site/login',
    login_url: 'https://www.optiwifi.site/login',
    whatsapp_url: '',
  },
  hero: {
    badge: 'Le logiciel des gérants de zones Wi-Fi',
    title_line1: 'Vos tickets Wi-Fi se vendent.',
    title_line2: 'Votre argent arrive-t-il en entier ?',
    subtitle:
      "OptiSpace suit chaque ticket du stock jusqu'à la caisse : ce que chaque point de vente a reçu, ce qu'il a vendu et ce que votre collecteur doit vous remettre. Au franc près, depuis votre téléphone.",
    cta_primary: 'Essayer gratuitement 5 jours',
    cta_secondary: 'Voir comment ça marche',
    trust: ['Sans carte bancaire', 'Pensé pour le téléphone', 'Abonnement payable par Wave'],
  },
  sections: Object.fromEntries(SITE_SECTION_KEYS.map((k) => [k, true])) as SiteSections,
  pricing: {
    title: "Moins cher qu'un seul écart de caisse.",
    subtitle:
      'Commencez gratuitement, passez au forfait qui suit la taille de votre réseau. Sans engagement, payable par Wave.',
    featured_plan_id: null,
    hidden_plan_ids: [],
  },
  faq: {
    items: [
      {
        q: "Je ne suis pas à l'aise avec l'informatique. Est-ce que c'est pour moi ?",
        a: "Oui. OptiSpace a été pensé pour être utilisé au téléphone, sur le terrain. Chaque encaissement se fait avec un assistant en 5 étapes qui vous guide : choisir le point de vente, saisir les tickets vendus, et l'outil calcule tout seul ce que vous devez recevoir.",
      },
      {
        q: "Mes collecteurs n'ont pas toujours de connexion. Ça marche quand même ?",
        a: 'Oui. Les saisies faites sans réseau sont gardées sur le téléphone puis envoyées automatiquement dès que la connexion revient. Un indicateur montre en permanence si vous êtes en ligne.',
      },
      {
        q: 'Comment je paie mon abonnement ?',
        a: 'Par Wave. Dans l\'outil, cliquez sur « Me réabonner », choisissez votre forfait, payez avec le QR code et envoyez le justificatif. Votre licence est activée et la facture est disponible en PDF.',
      },
      {
        q: 'Mes données sont-elles en sécurité ?',
        a: "Chaque organisation est isolée : vous ne voyez que vos données et personne d'autre ne voit les vôtres. Les accès sont protégés par mot de passe, chaque membre a un rôle (administrateur ou collecteur) et les actions sensibles sont tracées.",
      },
      {
        q: 'Je peux gérer plusieurs quartiers ou plusieurs villes ?',
        a: "Oui, avec les Espaces Wi-Fi. Vous regroupez vos points de vente par zone et chaque espace a son propre tableau de bord : tickets, chiffre d'affaires, encaissements et écarts.",
      },
      {
        q: "Que se passe-t-il à la fin de l'essai gratuit ?",
        a: "Rien n'est prélevé automatiquement. Vous recevez des rappels avant l'expiration et vous choisissez le forfait qui vous convient. Vos données restent conservées.",
      },
    ],
  },
  final_cta: {
    title: 'Dès la semaine prochaine,',
    highlight: 'vous saurez.',
    text: "Combien de tickets ont été vendus, combien d'argent doit rentrer, et qui vous le doit. Créez votre espace en quelques minutes et testez sur vos vrais points de vente.",
    cta_label: 'Créer mon espace gratuitement',
    note: '5 jours gratuits · Sans carte bancaire · Vos données restent les vôtres',
  },
  seo: {
    title: 'OptiSpace — Chaque ticket Wi-Fi vendu, chaque franc encaissé',
    description:
      'Le logiciel des gérants de zones Wi-Fi : suivez vos tickets par point de vente, encaissez vos collecteurs sans écart et pilotez tout votre réseau depuis votre téléphone.',
  },
};

// ---------------------------------------------------------------- validation

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class FieldError extends Error {}

function text(obj: Record<string, unknown>, key: string, label: string, max: number, required = true): string {
  const v = typeof obj[key] === 'string' ? (obj[key] as string).trim() : '';
  if (required && !v) throw new FieldError(`${label} : champ obligatoire`);
  if (v.length > max) throw new FieldError(`${label} : ${max} caractères maximum`);
  return v;
}

/** Lien autorisé : http(s), mailto: ou tel: (jamais javascript: ni data:). */
function link(obj: Record<string, unknown>, key: string, label: string, required = true): string {
  const v = text(obj, key, label, 500, required);
  if (!v) return '';
  try {
    const u = new URL(v);
    if (!['https:', 'http:', 'mailto:', 'tel:'].includes(u.protocol)) throw new Error();
  } catch {
    throw new FieldError(`${label} : lien invalide (doit commencer par https://)`);
  }
  return v;
}

function obj(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new FieldError('Format invalide');
  return value as Record<string, unknown>;
}

function parse(key: SiteContentKey, raw: unknown): SiteContent[SiteContentKey] {
  const o = obj(raw);
  switch (key) {
    case 'links':
      return {
        signup_url: link(o, 'signup_url', 'Lien « Essai gratuit »'),
        login_url: link(o, 'login_url', 'Lien « Se connecter »'),
        whatsapp_url: link(o, 'whatsapp_url', 'Lien WhatsApp', false),
      };
    case 'hero': {
      const trust = Array.isArray(o.trust) ? o.trust : [];
      if (trust.length > 4) throw new FieldError('Arguments de confiance : 4 maximum');
      return {
        badge: text(o, 'badge', 'Bandeau', 80, false),
        title_line1: text(o, 'title_line1', 'Titre, ligne 1', 80),
        title_line2: text(o, 'title_line2', 'Titre, ligne 2', 80),
        subtitle: text(o, 'subtitle', 'Sous-titre', 400),
        cta_primary: text(o, 'cta_primary', 'Bouton principal', 50),
        cta_secondary: text(o, 'cta_secondary', 'Bouton secondaire', 50),
        trust: trust
          .map((t, i) => text({ t }, 't', `Argument ${i + 1}`, 60, false))
          .filter(Boolean),
      };
    }
    case 'sections':
      return Object.fromEntries(SITE_SECTION_KEYS.map((k) => [k, o[k] !== false])) as SiteSections;
    case 'pricing': {
      const featured = o.featured_plan_id;
      if (featured !== null && featured !== undefined && featured !== '' && !(typeof featured === 'string' && UUID_RE.test(featured))) {
        throw new FieldError('Forfait mis en avant invalide');
      }
      const hidden = Array.isArray(o.hidden_plan_ids) ? o.hidden_plan_ids : [];
      if (!hidden.every((id) => typeof id === 'string' && UUID_RE.test(id))) throw new FieldError('Forfaits masqués invalides');
      return {
        title: text(o, 'title', 'Titre', 120),
        subtitle: text(o, 'subtitle', 'Sous-titre', 300, false),
        featured_plan_id: typeof featured === 'string' && featured ? featured : null,
        hidden_plan_ids: hidden as string[],
      };
    }
    case 'faq': {
      const items = Array.isArray(o.items) ? o.items : [];
      if (items.length > 20) throw new FieldError('20 questions maximum');
      return {
        items: items.map((it, i) => {
          const q = obj(it);
          return {
            q: text(q, 'q', `Question ${i + 1}`, 200),
            a: text(q, 'a', `Réponse ${i + 1}`, 1200),
          };
        }),
      };
    }
    case 'final_cta':
      return {
        title: text(o, 'title', 'Titre', 80),
        highlight: text(o, 'highlight', 'Fin du titre (en couleur)', 60, false),
        text: text(o, 'text', 'Texte', 400, false),
        cta_label: text(o, 'cta_label', 'Bouton', 50),
        note: text(o, 'note', 'Mention sous le bouton', 120, false),
      };
    case 'seo':
      return {
        title: text(o, 'title', 'Titre Google', 70),
        description: text(o, 'description', 'Description Google', 170),
      };
  }
}

export function parseSiteContent<K extends SiteContentKey>(key: K, raw: unknown): Parsed<SiteContent[K]> {
  try {
    return { ok: true, value: parse(key, raw) as SiteContent[K] };
  } catch (err) {
    return { ok: false, error: err instanceof FieldError ? err.message : 'Contenu invalide' };
  }
}

export function isSiteContentKey(key: unknown): key is SiteContentKey {
  return typeof key === 'string' && (SITE_CONTENT_KEYS as string[]).includes(key);
}
