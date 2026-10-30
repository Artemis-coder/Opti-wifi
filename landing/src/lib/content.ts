/**
 * Contenus du site vitrine : liens, forfaits, FAQ.
 * Les forfaits reprennent la table `subscription_plans` de l'outil
 * (relevés sur la base de dev le 29/10/2026) : à confirmer avant la mise en ligne.
 */

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.optiwifi.site").replace(/\/$/, "");

export const LINKS = {
  login: `${APP_URL}/login`,
  signup: `${APP_URL}/login`,
};

export type Plan = {
  name: string;
  price: number;
  period: string;
  pitch: string;
  limits: string[];
  extras: string[];
  cta: string;
  featured?: boolean;
};

export const PLANS: Plan[] = [
  {
    name: "Découverte",
    price: 0,
    period: "5 jours d'essai",
    pitch: "Testez OptiSpace sur un vrai point de vente, sans payer.",
    limits: ["1 point de vente", "1 utilisateur", "500 tickets / mois"],
    extras: ["Toutes les fonctionnalités", "Sans engagement, sans carte"],
    cta: "Commencer l'essai",
  },
  {
    name: "Standard",
    price: 2000,
    period: "par mois",
    pitch: "Pour le gérant qui fait grandir son réseau de revendeurs.",
    limits: ["10 points de vente", "2 utilisateurs", "2 000 tickets / mois"],
    extras: ["Toutes les fonctionnalités", "Paiement Wave, facture PDF"],
    cta: "Choisir Standard",
    featured: true,
  },
  {
    name: "Décideur (Pro)",
    price: 20000,
    period: "par mois",
    pitch: "Pour les réseaux établis avec plusieurs collecteurs sur le terrain.",
    limits: ["25 points de vente", "5 utilisateurs", "10 000 tickets / mois"],
    extras: ["Toutes les fonctionnalités", "Pensé pour plusieurs collecteurs"],
    cta: "Choisir Pro",
  },
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

export const FAQ = [
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
];

export const formatFcfa = (n: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n))} FCFA`;
