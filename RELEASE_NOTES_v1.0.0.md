# Opti Wi-Fi — Release v1.0.0

**Date de release :** 30 août 2026  
**Tag :** `v1.0.0`  
**Type :** Stable / Production Ready

---

## 📦 Résumé

Première version stable d'Opti Wi-Fi, application de gestion de points de vente, allocations de tickets et encaissements. Cette release marque le point de départ officiel du projet avec un socle fonctionnel complet, sécurisé et prêt pour la production.

---

## 🚀 Fonctionnalités Métier

### 1. Authentification & Gestion des Utilisateurs
- **Inscription / Connexion** via Supabase Auth
- **Rôles utilisateurs** : Administrateur et Collecteur
- **Profil utilisateur** : nom, email, rôle, téléphone
- **Réinitialisation de mot de passe** par email
- **Déconnexion sécurisée** avec nettoyage du state local

### 2. Points de Vente (POS)
- **CRUD complet** des points de vente (créer, modifier, consulter)
- **Vue détaillée par POS** avec informations complètes (nom, adresse, ville, statut, collecteur assigné, date de création)
- **KPIs POS** : nombre total de POS, POS actifs, POS désactivés
- **Activation / Désactivation** rapide d'un POS (toggle admin)
- **Recherche** par nom ou ville
- **Cartes cliquables** vers la page détail

### 3. Types de Tickets
- **Gestion des tarifs** : nom, durée (heures), prix (FCFA)
- **Activation / Désactivation** des tickets
- **Prix unitaire** par type de ticket

### 4. Allocations de Tickets
- **Allocation multi-tickets** : possibilité d'allouer plusieurs types de tickets en une seule opération
- **Date d'allocation** précise
- **Récapitulatif en temps réel** : POS sélectionné, date, détail par ticket (nom, prix, quantité), total tickets et montant total
- **Historique des allocations** consultable par POS
- **Validation des quantités** : un POS ne peut encaisser que des tickets qui lui ont été alloués

### 5. Assistant de Collecte & Encaissement (5 étapes)
- **Étape 1** : Choix du point de vente
- **Étape 2** : Saisie des quantités vendues (filtrées par allocations du POS)
  - Affichage : Alloué / Déjà vendu / Restant
  - Validation : quantité entrée ≤ stock disponible
- **Étape 3** : Calcul automatique du montant attendu
- **Étape 4** : Saisie du montant réellement encaissé + commission versée au POS + date de collecte
- **Étape 5** : Bilan & validation finale avec détection d'écarts

### 6. Historique des Collectes
- **Liste complète** des encaissements par POS
- **Colonnes** : Point de Vente, Collecteur, Montant Attendu, Montant Encaissé, Commission, Écart, Statut, Date
- **Badges de statut** : Validée, Brouillon, Annulée

### 7. Rapports & Exports CSV
- **KPIs consolidés** : nombre de POS, nombre de collecteurs, nombre de tickets vendus
- **Filtres par période** : date de début / date de fin
- **Export CSV** des encaissements (avec commission et écart)
- **Export CSV** des points de vente
- **Aperçu tableau** des encaissements avec pagination

### 8. Paramètres
- **Informations du compte** : modification du nom, téléphone (email en lecture seule)
- **Sécurité** : réinitialisation de mot de passe
- **Devise principale** : affichage de la devise, verrouillée après création du compte
- **Sécurité des données** : information sur la protection RLS

### 9. Dashboard
- **KPIs globaux** : Tickets Vendus, Tickets Alloués, Chiffre d'Affaires, Total Encaissé, Écart Global, POS Enregistrés
- **Derniers encaissements** : aperçu des 5 dernières collectes
- **Raccourcis métier** : accès rapide aux pages principales

---

## 🔒 Sécurité

- **Row Level Security (RLS)** activé sur toutes les tables Supabase
- **Isolation par rôle** : chaque utilisateur ne voit que ses propres données
- **Politiques RLS** :
  - `profiles` : utilisateur voit/modifie son propre profil, admin gère tous les profils
  - `points_of_sale` : admin gère tous les POS, collecteur voit ses POS assignés
  - `ticket_types` : tous voient les tickets actifs, admin gère les types
  - `ticket_allocations` : admin gère toutes les allocations, collecteur voit ses allocations
  - `collections` : admin gère toutes les collectes, collecteur gère ses collectes
  - `collection_items` : accès via la collection parente
- **Supabase Auth** : aucune logique d'authentification personnalisée
- **Requêtes ORM** : utilisation exclusive de l'ORM Supabase avec filtres `.eq()`
- **Pas de `dangerouslySetInnerHTML`** avec des données utilisateur
- **Validation côté client** des quantités avant insertion
- **Guidelines de sécurité pré-commit** ajoutées à `AGENTS.md`

---

## 🗄️ Base de Données

### Tables
- `profiles` : utilisateurs (nom, email, rôle, téléphone, devise)
- `points_of_sale` : points de vente (nom, adresse, ville, statut, collecteur assigné)
- `ticket_types` : types de tickets (nom, durée, prix, actif)
- `ticket_allocations` : allocations de tickets aux POS (POS, type de ticket, quantité, date, notes)
- `collections` : collectes de caisse (POS, collecteur, montant attendu, montant encaissé, commission, date de collecte, écart, statut, notes)
- `collection_items` : détail des tickets vendus par collecte (type de ticket, stock début, quantité vendue, prix unitaire, montant total)
- `audit_logs` : journal d'audit des opérations

### Migrations SQL
- `20260829_init.sql` : schéma initial avec RLS, triggers, seed de tickets
- `20260830_add_commission_and_currency.sql` : ajout des colonnes `commission`, `date_collecte` et `devise`

---

## 🎨 Interface & UX

- **Design responsive** : sidebar desktop + bottom nav mobile
- **Thème sombre** : support complet du mode sombre
- **Branding** : nom "Opti Wi-Fi", icône favicon SVG
- **Notifications** : toasts Sonner pour le feedback utilisateur
- **Loading states** : états de chargement sur toutes les pages
- **Empty states** : messages adaptés quand aucune donnée n'est présente
- **Guidelines de sécurité** pré-commit intégrées au workflow

---

## 📋 Prérequis techniques

- Node.js >= 18
- npm >= 9
- Compte Supabase avec projet configuré
- Variables d'environnement :
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 🛠️ Installation & Démarrage

```bash
# Installer les dépendances
npm install

# Copier les variables d'environnement
cp .env.example .env.local

# Exécuter les migrations SQL dans Supabase SQL Editor
# - 20260829_init.sql
# - 20260830_add_commission_and_currency.sql

# Lancer le serveur de développement
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

---

## ✅ Validation

- `tsc --noEmit` : 0 erreur
- `eslint` : 0 erreur
- RLS actif et testé sur toutes les tables
- Aucun secret hardcodé dans le code source

---

## 📝 Notes de version

- Version stable marquée par le tag `v1.0.0`
- Branche de référence : `main`
- Toutes les fonctionnalités métier sont fonctionnelles et testées
- Prêt pour la production et pour être forké/développé par d'autres contributeurs
