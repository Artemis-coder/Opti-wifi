# OptiSpace — site vitrine

Landing page de conversion, **application autonome** : rien n'est partagé avec l'outil (`../src`).
La racine du dépôt ignore ce dossier (tsconfig, ESLint).

```bash
cd landing
npm install
npm run dev   # http://localhost:3001
```

- Contenus (forfaits, FAQ, liens) : `src/lib/content.ts`
- Design system : copie de `../src/styles/design-system.css` dans `src/styles/` (à garder synchronisée)
- Captures réelles de l'outil : `public/screens/` (compte démo de la base dev)
- Variables : voir `.env.example`

## Licence

Propriétaire, tous droits réservés : voir [`../LICENSE`](../LICENSE).
