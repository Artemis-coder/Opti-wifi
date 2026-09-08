# Plan : Ajout de la KPI "Valeur du stock alloué" sur la liste des Points de Vente

## Contexte

Sur l'interface organisation (client), la page `/pos` liste les points de vente (POS) sous forme de grille de cartes.
Actuellement chaque carte affiche : nom, adresse/ville, badge statut, collecteur, ID.
La page détail `/pos/[id]` calcule déjà la valeur du stock alloué (nommée "CA" dans le code) selon la formule :
`Σ(quantite × ticket_type.prix)` en tenant compte des échanges (`exchange_return` = négatif).

L'objectif est d'afficher cette valeur — appelée **"Valeur du stock alloué"** — directement sur la liste :
- Une **KPI card cumulative** en haut (à côté de Total POS / Actifs / Désactivés)
- La **valeur par POS** dans chaque carte de la grille

## Décisions prises

- **Option 3** (demandée par l'utilisateur) : KPI cumulative + valeur par carte.
- **Formule** : `Σ(alloc.quantite × ticket_type.prix)` avec `exchange_return` compté négativement, identique à celle utilisée sur `/pos/[id]` (lignes 139-147) et `/allocations` (lignes 270-283).
- **Unité** : FCFA, via `formatCurrencyFCFA()`.
- **Pas de base de données** : la valeur est calculée côté client à partir des tables existantes (`ticket_allocations` + `ticket_types`). Aucune migration SQL n'est nécessaire.

## Fichiers à modifier

### 1. `src/app/(dashboard)/pos/page.tsx`

**Changements :**

a) Ajouter les imports manquants :
- `ArrowLeftRight` (déjà importé ? vérifier) — non, ajouter `ArrowLeftRight` depuis `lucide-react` pour l'icône.
- `formatCurrencyFCFA` depuis `@/lib/utils/format`.

b) Dans `loadData()` (ligne 30-56), ajouter deux requêtes Supabase en parallèle :
- `ticket_allocations` avec `ticket_type:ticket_types(*)` filtrées par `organization_id`.
- `ticket_types` filtrées par `organization_id` (pour la correspondance prix).

c) Ajouter l'état :
- `const [allocations, setAllocations] = useState<TicketAllocation[]>([]);`
- `const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);`

d) Ajouter une fonction de calcul (ou inline) :
```ts
function computePosStockValue(
  posId: string,
  allocations: TicketAllocation[],
  ticketTypes: TicketType[]
): number {
  return allocations
    .filter((a) => a.pos_id === posId)
    .reduce((sum, a) => {
      const tt = ticketTypes.find((t) => t.id === a.ticket_type_id) || a.ticket_type;
      const qty = a.type === 'exchange_return' ? -a.quantite : a.quantite;
      return sum + qty * (tt?.prix || 0);
    }, 0);
}
```

e) Ajouter la KPI card cumulative (4ème card, grid `lg:grid-cols-4` ou `col-span-2` selon l'espace) :
- Label : "Valeur du stock alloué"
- Icône : `ArrowLeftRight` ou `Package` — utiliser `ArrowLeftRight` (cohérent allocations).
- Couleur : `amber-500` (comme "Total POS").
- Valeur : `formatCurrencyFCFA(totalStockValue)` où `totalStockValue` = somme sur tous les POS.

f) Dans la carte de chaque POS (ligne 165-230), ajouter une ligne dans la section `pt-3 border-t` :
- Afficher "Valeur du stock alloué" avec la valeur FCFA calculée pour ce POS.

## Validation

1. `npm run lint` → 0 erreurs.
2. `npx tsc --noEmit` → 0 erreurs.
3. Vérifier visuellement :
   - La KPI cumulative s'affiche et est à jour quand des allocations existent.
   - Chaque carte POS affiche sa valeur (0 FCFA si aucune allocation).
   - Les échanges (`exchange_return`) sont comptés négativement.
   - La valeur cumulée = somme des valeurs par POS.

## Risques / Limites

- **Performance** : les requêtes `ticket_allocations` et `ticket_types` sont filtrées par `organization_id` ; les index RLS doivent couvrir cette requête (déjà le cas pour les autres pages).
- **Précision des prix** : le prix utilisé est celui actuel de `ticket_types.prix`, pas le prix historique de l'allocation. C'est cohérent avec la page détail `/pos/[id]` qui fait de même (elle utilise `s.ticketType.prix`). Si un besoin de prix historique apparaît, il faudrait un champ supplémentaire.
- **Aucune migration SQL** nécessaire.