# Opti Wifi

Application de gestion de points de vente, allocations de tickets et encaissements construite avec Next.js et Supabase.

## Stack Technique

- **Frontend** : Next.js 14 (App Router), React, TypeScript
- **UI** : Tailwind CSS, composants personnalisés (Card, Button, Input, Badge)
- **Backend** : Supabase (PostgreSQL, Auth, Storage)
- **Notifications** : Sonner

## Fonctionnalités

- **Points de Vente (POS)** : CRUD complet, vue détaillée par POS avec KPIs et historique
- **Types de Tickets** : Gestion des tarifs, durées et activation/désactivation
- **Allocations** : Attribution de stocks de tickets par POS avec suivi alloué/vendu/restant
- **Collectes** : Assistant de collecte & encaissement en 5 étapes
  - Sélection du POS
  - Saisie des quantités vendues (filtré par allocations du POS)
  - Calcul automatique du montant attendu
  - Saisie du montant réellement encaissé
  - Validation finale avec détection d'écarts
- **Dashboard** : KPIs globaux (tickets alloués, vendus, CA, écarts)

## Règles métier

- Un POS ne peut encaisser que des tickets qui lui ont été alloués
- La quantité vendue ne peut pas dépasser le stock disponible (alloué - déjà vendu)
- Les collectes sont liées à un POS et un collecteur

## Démarrage

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

Configurer les variables d'environnement Supabase dans `.env.local` :

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Scripts utiles

```bash
npm run dev      # Serveur de développement
npm run build    # Build de production
npm run lint     # Linting ESLint
npx tsc --noEmit # Vérification TypeScript
```

## Déploiement

Déployer sur Vercel ou tout hébergeur supportant Next.js. Les migrations SQL Supabase sont dans `supabase/migrations/`.
