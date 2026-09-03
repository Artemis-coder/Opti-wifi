# Phase 2 — Plan de Développement — Module Super Administrateur (SaaS Multi-Tenant)

## Contexte Général

La plateforme OptiWifi est une application Next.js 16 + Tailwind + Supabase (PostgreSQL). Elle existe aujourd'hui en tant qu'application **client unique-tenant** (administrateur/collecteur). La Phase 2 ajoute une couche **Super Administrateur SaaS multi-tenant** avec :

- Un back-office dédié (`/platform/*`)
- Une architecture multi-tenant (organizations → clients → utilisateurs → données)
- Gestion des abonnements, plans, paiements, factures
- Dashboard analytique SaaS
- Audit logs & impersonation

## Architecture Proposée

```
PLATFORM BACK-OFFICE                 CLIENT APP
┌─────────────────────────┐          ┌─────────────────────┐
│ /platform/login         │          │ /login              │
│ /platform/dashboard     │          │ /dashboard          │
│ /platform/clients       │          │ /pos                │
│ /platform/subscriptions │          │ /collections        │
│ /platform/plans         │          │ /tickets            │
│ /platform/payments      │          │ /allocations        │
│ /platform/audit-logs    │          │ /users              │
│ /platform/settings      │          │ /reports            │
└─────────────────────────┘          └─────────────────────┘
        ↑                                        ↑
        └────────── Supabase (PostgreSQL + RLS) ─┘
                       │
                       ├── organizations         (clients SaaS)
                       ├── platform_users        (super admins)
                       ├── subscription_plans    (offres)
                       ├── subscriptions         (liens org→plan)
                       ├── payments              (transactions)
                       ├── invoices              (factures)
                       ├── profiles              (utilisateurs clients — EXISTANT)
                       ├── points_of_sale        (POS — EXISTANT, + organization_id)
                       ├── wifi_spaces           (espaces — EXISTANT, + organization_id)
                       ├── ticket_allocations    (--- EXISTANT, + organization_id)
                       ├── collections           (--- EXISTANT, + organization_id)
                       ├── collection_items      (--- EXISTANT, + organization_id)
                       └── platform_audit_logs   (nouveau — actions super admin)
```

### Rôles & Sécurité

| Rôle | Niveau | Accès |
|---|---|---|
| `super_admin` | Plateforme | Accès global à tout (via `platform_users`) |
| `platform_support` | Plateforme | Lecture + support (audit logs, impersonation) |
| `administrateur` | Client | Gestion de son organisation |
| `collecteur` | Client | Opérations terrain |

- RLS : `is_platform_super_admin()` + `organization_id` filtering
- Middleware protège `/platform/*` : vérifie rôle dans `platform_users`
- Séparation complète entre `/platform/*` (back-office) et `/dashboard/*` (client)

## Phases de Développement

> Voir le fichier `docs/PHASE2_PLAN.md` pour le plan détaillé par sprint.

### Sprint 1 — Infrastructure (DB + Auth + Layout)
- [x] Analyse du codebase existant
- [ ] Migration SQL : nouvelles tables + colonnes organization_id + RLS + helper functions
- [ ] Types TypeScript étendus (`src/types/platform.ts`)
- [ ] Store d'authentification platform (`src/lib/stores/platformAuthStore.ts`)
- [ ] Middleware mis à jour pour `/platform/*`
- [ ] Layout `/platform/layout.tsx` + Sidebar admin
- [ ] Page `/platform/login`

### Sprint 2 — Dashboard Super Admin
- [ ] KPI cards (clients totaux, actifs, suspendus, nouveaux, abonnements, expirations, revenus)
- [ ] Graphique : évolution des inscriptions (recharts)
- [ ] Graphique : évolution des abonnements
- [ ] Graphique : revenus (MRR/ARR)
- [ ] Graphique : répartition des plans

### Sprint 3 — Gestion des Clients (Organizations)
- [ ] Liste des clients (`/`platform/clients`) avec table triable/filtrable
- [ ] Fiche client (`/platform/clients/[id]`) — infos générales, activité, abonnement
- [ ] Actions : activer / suspendre / réactiver (avec confirmation)
- [ ] Impersonation : lien "Accéder à l'espace client" (enregistré dans audit_logs)

### Sprint 4 — Abonnements & Plans
- [ ] Gestion des plans (`/platform/plans`) — CRUD complet
- [ ] Gestion des abonnements (`/platform/subscriptions`) — liste + statut
- [ ] Changer l'abonnement d'un client depuis la fiche

### Sprint 5 — Paiements, Factures & Audit
- [ ] Liste des paiements (`/platform/payments`) — filtres (statut, période, client)
- [ ] Factures (`/platform/invoices`)
- [ ] Journal d'audit (`/platform/audit-logs`)

### Sprint 6 — Paramètres & Maintenance
- [ ] Paramètres plateforme (`/platform/settings`) — nom, devise, maintenance, période d'essai, grâce
- [ ] Mode maintenance

### Sprint 7 — MVP Commerciale (Analytics)
- [ ] Commencer à exposer les hooks/metrics pour le cycle commercial
