/**
 * Crée dans PostHog les tableaux de bord KPI d'OptiSpace (outil + site vitrine).
 * Idempotent : un tableau de bord déjà présent (même nom) est laissé tel quel.
 *
 * Variables (dans .env.local, jamais commitées) :
 *   POSTHOG_PERSONAL_API_KEY  clé personnelle (Settings → Personal API keys),
 *                             droits : dashboard:write, insight:write, project:read
 *   POSTHOG_PROJECT_ID        identifiant numérique du projet (Settings → Project)
 *   POSTHOG_APP_HOST          https://us.posthog.com (défaut) ou https://eu.posthog.com
 *
 *   node scripts/posthog-dashboards.mjs            # crée ce qui manque
 *   node scripts/posthog-dashboards.mjs --dry-run  # affiche ce qui serait créé
 *
 * Les événements sont définis dans src/lib/analytics/events.ts (outil) et
 * landing/src/instrumentation-client.ts (site, branche landing).
 */
import fs from "node:fs";

const env = { ...process.env };
for (const file of [".env.local"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
    if (m && !env[m[1]]) env[m[1]] = m[2];
  }
}
const KEY = env.POSTHOG_PERSONAL_API_KEY;
const PROJECT = env.POSTHOG_PROJECT_ID;
const HOST = (env.POSTHOG_APP_HOST || "https://us.posthog.com").replace(/\/$/, "");
const DRY = process.argv.includes("--dry-run");

if (!DRY && (!KEY || !PROJECT)) {
  console.error("POSTHOG_PERSONAL_API_KEY et POSTHOG_PROJECT_ID sont requis (voir l'en-tête du script).");
  process.exit(1);
}

// ------------------------------------------------------------------ briques

/** Uniquement la production, hors comptes de test (filtre « test accounts » du projet). */
const PROD = [{ key: "environment", value: ["production"], operator: "exact", type: "event" }];
const prop = (key, value, operator = "exact") => ({ key, value: Array.isArray(value) ? value : [value], operator, type: "event" });

const ev = (event, extra = {}) => ({ kind: "EventsNode", event, name: event, ...extra });

const trends = (series, { interval = "day", from = "-30d", display = "ActionsLineGraph", breakdown, formula, props = [] } = {}) => ({
  kind: "InsightVizNode",
  source: {
    kind: "TrendsQuery",
    series,
    interval,
    dateRange: { date_from: from },
    properties: [...PROD, ...props],
    filterTestAccounts: true,
    ...(breakdown ? { breakdownFilter: { breakdown, breakdown_type: "event" } } : {}),
    trendsFilter: { display, ...(formula ? { formula } : {}) },
  },
});

const funnel = (series, { from = "-30d", windowDays = 7 } = {}) => ({
  kind: "InsightVizNode",
  source: {
    kind: "FunnelsQuery",
    series,
    dateRange: { date_from: from },
    properties: PROD,
    filterTestAccounts: true,
    funnelsFilter: { funnelWindowInterval: windowDays, funnelWindowIntervalUnit: "day", funnelVizType: "steps" },
  },
});

const orgs = (event, name) => ev(event, { math: "hogql", math_hogql: "count(distinct properties.organization_id)", custom_name: name });

// ------------------------------------------------------------------ KPI

const DASHBOARDS = [
  {
    name: "OptiSpace · Acquisition (site vitrine)",
    description: "Visites de space.optiwifi.site, clics vers l'outil et inscriptions.",
    insights: [
      {
        name: "Visiteurs uniques du site",
        description: "Personnes différentes ayant vu le site vitrine, par jour.",
        query: trends([ev("$pageview", { math: "dau", custom_name: "Visiteurs", properties: [prop("app", "site")] })]),
      },
      {
        name: "Clics « Essai gratuit » par emplacement",
        description: "Où les visiteurs cliquent pour s'inscrire (accroche, tarifs, calculateur…).",
        query: trends([ev("cta_clicked", { properties: [prop("cta", "signup")] })], { display: "ActionsBarValue", breakdown: "location" }),
      },
      {
        name: "Tunnel : visite → clic → inscription",
        description: "Part des visiteurs du site qui cliquent puis créent leur compte (7 jours).",
        query: funnel([
          ev("$pageview", { custom_name: "Visite du site", properties: [prop("app", "site")] }),
          ev("cta_clicked", { custom_name: "Clic « Essai gratuit »", properties: [prop("cta", "signup")] }),
          ev("organization_registered", { custom_name: "Compte créé" }),
        ]),
      },
      {
        name: "Inscriptions par semaine",
        query: trends([ev("organization_registered", { custom_name: "Inscriptions" })], { interval: "week", from: "-90d", display: "ActionsBar" }),
      },
      {
        name: "Engagement sur le site",
        description: "Utilisation du calculateur de fuites et questions de la FAQ ouvertes.",
        query: trends([ev("calculator_used", { custom_name: "Calculateur utilisé" }), ev("faq_opened", { custom_name: "Questions FAQ ouvertes" })]),
      },
      {
        name: "Forfaits choisis depuis le site",
        query: trends([ev("cta_clicked", { properties: [prop("location", "pricing")] })], { display: "ActionsPie", breakdown: "plan" }),
      },
    ],
  },
  {
    name: "OptiSpace · Activation & usage",
    description: "Utilisation réelle de l'outil par les clients.",
    insights: [
      {
        name: "Utilisateurs actifs (jour / semaine)",
        query: trends([
          ev("$pageview", { math: "dau", custom_name: "Actifs du jour", properties: [prop("app", "outil")] }),
          ev("$pageview", { math: "weekly_active", custom_name: "Actifs sur 7 jours", properties: [prop("app", "outil")] }),
        ]),
      },
      {
        name: "Organisations actives par semaine",
        description: "Clients ayant enregistré au moins un encaissement dans la semaine.",
        query: trends([orgs("collection_recorded", "Organisations actives")], { interval: "week", from: "-90d", display: "ActionsBar" }),
      },
      {
        name: "Encaissements enregistrés",
        query: trends([ev("collection_recorded", { custom_name: "Encaissements" })]),
      },
      {
        name: "Montant encaissé (FCFA)",
        query: trends(
          [
            ev("collection_recorded", { math: "sum", math_property: "amount_collected", custom_name: "Encaissé" }),
            ev("collection_recorded", { math: "sum", math_property: "amount_expected", custom_name: "Attendu" }),
          ],
          { interval: "week", from: "-90d" },
        ),
      },
      {
        name: "Encaissements avec écart (%)",
        description: "Part des encaissements où l'argent remis ne correspond pas au montant attendu.",
        query: trends(
          [ev("collection_recorded", { properties: [prop("has_gap", ["true"])], custom_name: "Avec écart" }), ev("collection_recorded", { custom_name: "Tous" })],
          { interval: "week", from: "-90d", formula: "A / B * 100" },
        ),
      },
      {
        name: "Écart cumulé (FCFA)",
        description: "Somme des écarts (négatif = argent manquant).",
        query: trends([ev("collection_recorded", { math: "sum", math_property: "gap", custom_name: "Écart" })], { interval: "week", from: "-90d", display: "ActionsBar" }),
      },
      {
        name: "Tickets alloués et échangés",
        query: trends(
          [
            ev("tickets_allocated", { math: "sum", math_property: "quantity", custom_name: "Tickets alloués" }),
            ev("tickets_exchanged", { math: "sum", math_property: "tickets_received", custom_name: "Tickets échangés" }),
          ],
          { interval: "week", from: "-90d" },
        ),
      },
      {
        name: "Tunnel d'activation",
        description: "De la création du compte au premier encaissement (30 jours).",
        query: funnel(
          [
            ev("organization_registered", { custom_name: "Compte créé" }),
            ev("user_logged_in", { custom_name: "Connexion" }),
            ev("pos_created", { custom_name: "Point de vente créé" }),
            ev("collection_recorded", { custom_name: "Premier encaissement" }),
          ],
          { from: "-90d", windowDays: 30 },
        ),
      },
      {
        name: "Exports de rapports",
        query: trends([ev("report_exported")], { interval: "week", from: "-90d", display: "ActionsBar", breakdown: "report" }),
      },
    ],
  },
  {
    name: "OptiSpace · Licences & revenus",
    description: "Demandes, activations et revenus des licences.",
    insights: [
      {
        name: "Revenus des licences par mois (FCFA)",
        query: trends([ev("license_activated", { math: "sum", math_property: "amount", custom_name: "Revenus" })], {
          interval: "month",
          from: "-12m",
          display: "ActionsBar",
          props: [prop("is_trial", ["false"])],
        }),
      },
      {
        name: "Revenus par forfait",
        query: trends([ev("license_activated", { math: "sum", math_property: "amount", custom_name: "Revenus" })], {
          from: "-90d",
          display: "ActionsPie",
          breakdown: "plan_name",
        }),
      },
      {
        name: "Demandes, activations et refus",
        query: trends(
          [
            ev("license_requested", { custom_name: "Demandes" }),
            ev("license_activated", { custom_name: "Activations" }),
            ev("license_request_rejected", { custom_name: "Refus" }),
          ],
          { interval: "week", from: "-90d", display: "ActionsBar" },
        ),
      },
      {
        name: "Activations par forfait",
        query: trends([ev("license_activated")], { interval: "month", from: "-12m", display: "ActionsBar", breakdown: "plan_name" }),
      },
      {
        name: "Inscriptions validées par le super admin",
        query: trends([ev("organization_status_changed", { properties: [prop("action", "approve")], custom_name: "Validations" })], {
          interval: "week",
          from: "-90d",
          display: "ActionsBar",
        }),
      },
    ],
  },
];

// ------------------------------------------------------------------ API

async function api(path, init = {}) {
  const res = await fetch(`${HOST}/api/projects/${PROJECT}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method || "GET"} ${path} → ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  if (DRY) {
    for (const d of DASHBOARDS) {
      console.log(`\n${d.name}`);
      for (const i of d.insights) console.log(`  • ${i.name}`);
    }
    return;
  }
  const existing = await api(`/dashboards/?limit=200`);
  const names = new Set((existing.results || []).filter((d) => !d.deleted).map((d) => d.name));

  for (const d of DASHBOARDS) {
    if (names.has(d.name)) {
      console.log(`= ${d.name} (déjà présent)`);
      continue;
    }
    const dash = await api(`/dashboards/`, {
      method: "POST",
      body: JSON.stringify({ name: d.name, description: d.description, tags: ["optispace"] }),
    });
    for (const i of d.insights) {
      await api(`/insights/`, {
        method: "POST",
        body: JSON.stringify({ name: i.name, description: i.description || "", query: i.query, dashboards: [dash.id], tags: ["optispace"] }),
      });
    }
    console.log(`✓ ${d.name} (${d.insights.length} indicateurs) → ${HOST}/project/${PROJECT}/dashboard/${dash.id}`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
