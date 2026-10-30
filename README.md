# OptiSpace — site vitrine

Landing page de conversion, **application autonome** sur sa propre branche Git : `landing`.
Cette branche ne contient que le site ; l'outil vit sur `develop` / `main`.

Toute amélioration du site se fait ici, sur `landing`. Chaque push déploie
le projet Vercel `optispace-landing` (production : https://optispace-landing.vercel.app).

Dans le dépôt local de l'outil, ce dossier est un worktree de la branche `landing`
(`git worktree add landing landing`), ignoré par `develop`.

```bash
npm install
npm run dev   # http://localhost:3001
```

- Contenus (forfaits, FAQ, liens) : `src/lib/content.ts`
- Design system : copie de `src/styles/design-system.css` de l'outil (branche `develop`) dans `src/styles/` (à garder synchronisée)
- Captures réelles de l'outil : `public/screens/` (compte démo de la base dev)
- Variables : voir `.env.example`

## Licence

Propriétaire, tous droits réservés : voir [`LICENSE`](LICENSE).
