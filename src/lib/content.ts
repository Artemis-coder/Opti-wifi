/**
 * Contenu du site vitrine.
 *
 * Source : back-office OptiSpace → Site vitrine (table `site_content`), lu via
 * l'API publique de l'outil. Les valeurs ci-dessous servent de secours si l'API
 * ne répond pas : garder les mêmes que SITE_DEFAULTS de l'outil
 * (src/lib/site-content-schema.ts, branche develop).
 */

export type SiteContent = {
  links: { signup_url: string; login_url: string; whatsapp_url: string };
  hero: {
    badge: string;
    title_line1: string;
    title_line2: string;
    subtitle: string;
    cta_primary: string;
    cta_secondary: string;
    trust: string[];
  };
  sections: Record<SectionKey, boolean>;
  pricing: { title: string; subtitle: string; featured_plan_id: string | null; hidden_plan_ids: string[] };
  faq: { items: { q: string; a: string }[] };
  final_cta: { title: string; highlight: string; text: string; cta_label: string; note: string };
  seo: { title: string; description: string };
};

export type SectionKey =
  | "pains"
  | "calculator"
  | "how_it_works"
  | "showcase"
  | "field"
  | "audience"
  | "pricing"
  | "faq"
  | "final_cta";

/** Forfait tel que renvoyé par l'API (table subscription_plans de l'outil). */
export type ApiPlan = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  billing_period: string;
  trial_days: number | null;
  max_users: number | null;
  max_points_of_sale: number | null;
  max_collectors?: number | null;
  max_tickets_per_month: number | null;
  /** Fonctionnalités saisies dans le back-office (Forfaits) */
  features?: string[];
};

export type Plan = {
  id: string;
  name: string;
  price: number;
  period: string;
  pitch: string;
  limits: string[];
  features: string[];
  cta: string;
  featured: boolean;
  maxPos: number | null;
};

export type Site = { content: SiteContent; plans: Plan[] };

const APP_URL = "https://www.optiwifi.site";

export const DEFAULT_CONTENT: SiteContent = {
  links: { signup_url: `${APP_URL}/login`, login_url: `${APP_URL}/login`, whatsapp_url: "" },
  hero: {
    badge: "Le logiciel des gérants de zones Wi-Fi",
    title_line1: "Vos tickets Wi-Fi se vendent.",
    title_line2: "Votre argent arrive-t-il en entier ?",
    subtitle:
      "OptiSpace suit chaque ticket du stock jusqu'à la caisse : ce que chaque point de vente a reçu, ce qu'il a vendu et ce que votre collecteur doit vous remettre. Au franc près, depuis votre téléphone.",
    cta_primary: "Essayer gratuitement 5 jours",
    cta_secondary: "Voir comment ça marche",
    trust: ["Sans carte bancaire", "Pensé pour le téléphone", "Abonnement payable par Wave"],
  },
  sections: {
    pains: true,
    calculator: true,
    how_it_works: true,
    showcase: true,
    field: true,
    audience: true,
    pricing: true,
    faq: true,
    final_cta: true,
  },
  pricing: {
    title: "Moins cher qu'un seul écart de caisse.",
    subtitle:
      "Commencez gratuitement, passez au forfait qui suit la taille de votre réseau. Sans engagement, payable par Wave.",
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
        a: "Oui. Les saisies faites sans réseau sont gardées sur le téléphone puis envoyées automatiquement dès que la connexion revient. Un indicateur montre en permanence si vous êtes en ligne.",
      },
      {
        q: "Comment je paie mon abonnement ?",
        a: "Par Wave. Dans l'outil, cliquez sur « Me réabonner », choisissez votre forfait, payez avec le QR code et envoyez le justificatif. Votre licence est activée et la facture est disponible en PDF.",
      },
      {
        q: "Mes données sont-elles en sécurité ?",
        a: "Chaque organisation est isolée : vous ne voyez que vos données et personne d'autre ne voit les vôtres. Les accès sont protégés par mot de passe, chaque membre a un rôle (administrateur ou collecteur) et les actions sensibles sont tracées.",
      },
      {
        q: "Je peux gérer plusieurs quartiers ou plusieurs villes ?",
        a: "Oui, avec les Espaces Wi-Fi. Vous regroupez vos points de vente par zone et chaque espace a son propre tableau de bord : tickets, chiffre d'affaires, encaissements et écarts.",
      },
      {
        q: "Que se passe-t-il à la fin de l'essai gratuit ?",
        a: "Rien n'est prélevé automatiquement. Vous recevez des rappels avant l'expiration et vous choisissez le forfait qui vous convient. Vos données restent conservées.",
      },
    ],
  },
  final_cta: {
    title: "Dès la semaine prochaine,",
    highlight: "vous saurez.",
    text: "Combien de tickets ont été vendus, combien d'argent doit rentrer, et qui vous le doit. Créez votre espace en quelques minutes et testez sur vos vrais points de vente.",
    cta_label: "Créer mon espace gratuitement",
    note: "5 jours gratuits · Sans carte bancaire · Vos données restent les vôtres",
  },
  seo: {
    title: "OptiSpace — Chaque ticket Wi-Fi vendu, chaque franc encaissé",
    description:
      "Le logiciel des gérants de zones Wi-Fi : suivez vos tickets par point de vente, encaissez vos collecteurs sans écart et pilotez tout votre réseau depuis votre téléphone.",
  },
};

/** Forfaits de secours (relevés sur la base dev le 29/10/2026). */
const DEFAULT_PLANS: ApiPlan[] = [
  { id: "c656bcbe-a203-4523-9aa9-7a91a4f666d8", name: "Découverte", description: "Testez OptiSpace sur un vrai point de vente, sans payer.", price: 0, currency: "XOF", billing_period: "monthly", trial_days: 5, max_users: 1, max_points_of_sale: 1, max_collectors: null, max_tickets_per_month: 500, features: [] },
  { id: "400f0254-bf85-4b8c-840c-0fdec024cacc", name: "Standard", description: "Pour le gérant qui fait grandir son réseau de revendeurs.", price: 2000, currency: "XOF", billing_period: "monthly", trial_days: 0, max_users: 2, max_points_of_sale: 10, max_collectors: null, max_tickets_per_month: 2000, features: [] },
  { id: "6f792040-96aa-401d-88a1-c31c8c1e879a", name: "Décideur (Pro)", description: "Pour les réseaux établis avec plusieurs collecteurs sur le terrain.", price: 20000, currency: "XOF", billing_period: "monthly", trial_days: 0, max_users: 5, max_points_of_sale: 25, max_collectors: null, max_tickets_per_month: 10000, features: [] },
];

export const INCLUDED = [
  "Tableau de bord temps réel",
  "Assistant d'encaissement en 5 étapes",
  "Détection automatique des écarts",
  "Allocations & échanges de tickets",
  "Espaces Wi-Fi multi-sites",
  "Commissions des collecteurs",
  "Rapports & exports CSV",
  "Mode hors-ligne",
  "Notifications push",
];

const fr = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export const formatFcfa = (n: number) => `${fr.format(Math.round(n))} FCFA`;

const PERIODS: Record<string, string> = { monthly: "par mois", quarterly: "par trimestre", yearly: "par an", annual: "par an" };

function plural(n: number, one: string, many: string) {
  return `${fr.format(n)} ${n > 1 ? many : one}`;
}

/**
 * Carte de tarif telle que configurée dans le back-office (Forfaits) : rien n'est
 * inventé ici. Limite vide = non affichée, -1 = illimité.
 */
export function toPlans(api: ApiPlan[], featuredId: string | null): Plan[] {
  const limit = (n: number | null | undefined, one: string, many: string, suffix = "") =>
    n == null ? null : n < 0 ? `${many.charAt(0).toUpperCase()}${many.slice(1)} illimités${suffix}` : `${plural(n, one, many)}${suffix}`;

  return api.map((p) => {
    const free = p.price === 0;
    const trial = p.trial_days && p.trial_days > 0 ? p.trial_days : 0;
    const limits = [
      limit(p.max_points_of_sale, "point de vente", "points de vente"),
      limit(p.max_users, "utilisateur", "utilisateurs"),
      limit(p.max_collectors, "collecteur", "collecteurs"),
      p.max_tickets_per_month == null ? null : p.max_tickets_per_month < 0 ? "Tickets illimités" : `${fr.format(p.max_tickets_per_month)} tickets / mois`,
      !free && trial ? `${plural(trial, "jour", "jours")} d'essai gratuit` : null,
    ].filter((l): l is string => Boolean(l));
    return {
      id: p.id,
      name: p.name,
      price: p.price,
      period: free && trial ? `${plural(trial, "jour", "jours")} d'essai` : PERIODS[p.billing_period] ?? "par mois",
      pitch: p.description ?? "",
      limits,
      features: Array.isArray(p.features) ? p.features : [],
      cta: free ? "Commencer l'essai" : `Choisir ${p.name}`,
      featured: p.id === featuredId,
      maxPos: p.max_points_of_sale == null || p.max_points_of_sale < 0 ? null : p.max_points_of_sale,
    };
  });
}

/** Forfait le moins cher qui couvre ce nombre de points de vente. */
export function planForPos(plans: Plan[], pos: number): Plan | undefined {
  const sorted = [...plans].sort((a, b) => a.price - b.price);
  return sorted.find((p) => p.maxPos == null || p.maxPos >= pos) ?? sorted[sorted.length - 1];
}

const CONTENT_API =
  process.env.SITE_CONTENT_API_URL ?? `${process.env.NEXT_PUBLIC_APP_URL ?? APP_URL}/api/public/site-content`;

/** Relu au plus toutes les 60 s ; en cas d'échec, le contenu de secours s'affiche. */
export async function getSite(): Promise<Site> {
  try {
    const res = await fetch(CONTENT_API, { next: { revalidate: 60 }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { content?: Partial<SiteContent>; plans?: ApiPlan[] };
    const content = { ...DEFAULT_CONTENT, ...data.content } as SiteContent;
    content.sections = { ...DEFAULT_CONTENT.sections, ...content.sections };
    const api = Array.isArray(data.plans) && data.plans.length > 0 ? data.plans : DEFAULT_PLANS;
    return { content, plans: toPlans(api, content.pricing.featured_plan_id) };
  } catch (err) {
    console.warn("Contenu du site indisponible, contenu de secours utilisé :", err instanceof Error ? err.message : err);
    return { content: DEFAULT_CONTENT, plans: toPlans(DEFAULT_PLANS, DEFAULT_CONTENT.pricing.featured_plan_id) };
  }
}
