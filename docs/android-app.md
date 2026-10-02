# Application Android (OptiSpace)

L'application web Next.js est empaquetée dans une application Android native via
**Capacitor 7**. Le code Kotlin/Compose n'est pas utilisé : la couche UI Material 3
est appliquée directement au front (Tailwind + composants `src/components/ui`),
tandis que Capacitor fournit le shell Android (WebView, barre d'état, splash, clavier).

## Prérequis

| Outil | Emplacement sur cette machine |
| --- | --- |
| JDK 21 | `/Applications/Android Studio.app/Contents/jbr/Contents/Home` |
| Android SDK | `~/Library/Android/sdk` |
| Gradle | fourni par `android/gradlew` (wrapper 8.11.1) |

## Configuration

`capacitor.config.ts` lit l'URL de déploiement depuis la variable
d'environnement `CAP_SERVER_URL` (avec un repli explicite dans le fichier) :

```bash
export CAP_SERVER_URL="https://votre-domaine.vercel.app"
```

L'APK charge cette URL dans sa WebView. **Le site doit être en ligne**, sinon
l'application affiche une page blanche.

## Commandes

```bash
npm run android:assets     # régénère icônes + splash depuis "Icon app/OptiSpace.jpg"
npm run android:sync       # copie la config et les plugins dans android/
npm run android:apk        # build release signé -> android/app/build/outputs/apk/release/
npm run android:open       # ouvre le projet dans Android Studio
npm run android:apk:debug  # build debug
```

L'APK est ensuite copié dans `android/dist/`.

## Signature

La clé est dans `android/optiwifi-release.keystore`, paramétrée via
`android/keystore.properties` (alias, chemins et mots de passe y sont conservés
hors du dépôt). **Ces deux fichiers sont ignorés par git** : il faut les
sauvegarder hors du dépôt, sinon aucune mise à jour de l'APK ne pourra être
publiée. Les mots de passe ne sont volontairement pas documentés ici.

## Icône

`scripts/generate_android_assets.py` (Python stdlib uniquement) compose les
mipmaps adaptatifs, l'icône monochrome Material You (Android 13+) et les splash
screens à partir de `Icon app/OptiSpace.jpg` : icône plein cadre pour les
mipmaps legacy, artwork cantonnée dans la zone visible 72dp pour la couche
adaptative (fond `#84C865`), badge circulaire sur le vert chrome `#1B3F2B`
pour le splash.
La layered `monochrome` de `mipmap-anydpi-v26/ic_launcher.xml` active les
icônes thématiques Material You sur Android 13+.

## Règles Material 3 appliquées au front

- Design system : `src/styles/design-system.css` (tokens Tailwind `brand-*`,
  source canonique) et son miroir TypeScript `src/lib/design-system.ts`
  (graphiques, config native). Palette Material 3 dans `src/app/globals.css`
  (`--md-*`).
- Vert OptiSpace : primaire `#3F9E63`, secondaire `#84C865`, chrome `#1B3F2B`.
- Cibles tactiles minimales 48dp (`.tap-target`, `.md-ripple` pour le state layer).
- Barre de navigation Material 3 (hauteur 80dp, indicateur actif en pilule).
- Modales en *modal bottom sheet* sur mobile, dialogues dès `sm`.
- Safe areas (`env(safe-area-inset-*)`) pour l'encoche et la barre de geste.
- Tableaux denses : cartes sur mobile, tableau dès `sm` (allocations, collectes),
  défilement horizontal pour les autres pages.
- `prefers-reduced-motion` respecté.
