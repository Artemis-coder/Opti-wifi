# CHECK SÉCURITÉ — Procédure de test d'intrusion et checklist (tous projets)

> Document générique, à utiliser sur **chaque projet** avant une mise en production importante et au moins une fois par trimestre.
> Il sert à un humain comme à un agent IA : chaque point dit **quoi tester**, **comment** et **ce qui est attendu**.
> Exemple d'application complète : [`docs/securite/RAPPORT_PENTEST_2026-11-15.md`](./securite/RAPPORT_PENTEST_2026-11-15.md) (OptiWifi).

---

## 0. Règles d'engagement (avant de commencer)

- [ ] **Jamais sur la production.** Tester en local ou sur une Preview, branchée sur la base de **développement**. Vérifier l'hôte de la base avant le premier test (`grep -o 'ep-[a-z-]*' .env.local` ou équivalent).
- [ ] Vérifier qu'un `.env.production*` local ne peut pas être chargé par erreur (`next start` le charge automatiquement). Forcer les variables de dev pour lancer un build local.
- [ ] Créer des **comptes et une organisation « attaquante » dédiés** au test, et ne jamais réutiliser les données de quelqu'un d'autre. Tout supprimer à la fin.
- [ ] Noter l'état des lignes de configuration partagées avant de les modifier, et les restaurer exactement.
- [ ] Prévoir les effets de bord : e-mails, SMS, notifications push, Telegram, webhooks, crédits d'IA, paiements de test.
- [ ] `git status` propre ou changements en cours identifiés ; travailler sur la bonne branche.

---

## 1. Méthode (dans cet ordre)

1. **Cartographier** : lister toutes les routes (`find src/app/api -name route.ts`), les méthodes, la vérification d'authentification de chacune, les rôles, les tables, les intégrations (webhooks, crons, bots, IA).
   Astuce : pour chaque route, chercher le garde utilisé (`getSession…`, `requireAdmin…`, secret) et **signaler toute route sans garde**.
2. **Revue de code ciblée** : passerelles génériques vers la base, SQL dynamique (`${` dans une requête), JWT, mots de passe, uploads, rendu HTML, secrets.
3. **Exploiter réellement** chaque hypothèse avec des scripts (une faille n'est retenue que si elle est **prouvée**).
4. **Classer** (grille § 4), **corriger**, puis **rejouer exactement les mêmes attaques** pour prouver la correction.
5. **Vérifier la non-régression** de l'usage normal, pour chaque rôle.
6. **Test de charge** (§ 3).
7. **Rapport** (§ 5) et nettoyage.

---

## 2. Checklist des attaques

### 2.1 Authentification
- [ ] **Force brute** : 50 à 100 mauvais mots de passe en parallèle. *Attendu : 429 au-delà d'un seuil par IP, et verrouillage du compte en base après N échecs (compteur **atomique**, à tester avec des essais simultanés depuis plusieurs IP).*
- [ ] **Énumération des comptes** : comparer les messages **et les temps de réponse** entre un compte existant et un compte inconnu (connexion, mot de passe oublié, inscription). *Attendu : même message, temps équivalent.*
- [ ] **Mot de passe oublié** : envois illimités ? Lien construit à partir de l'en-tête `Host` / `X-Forwarded-Host` (empoisonnement) ? Lien à usage unique et de courte durée ?
- [ ] **Changement de mot de passe** : l'ancien est-il exigé ? La règle de complexité est-elle appliquée **côté serveur** sur **toutes** les routes qui écrivent un mot de passe (y compris les vieilles routes oubliées) ?
- [ ] **Révocation** : après un changement ou une réinitialisation, les **autres sessions** sont-elles refusées ? Et après une déconnexion ?
- [ ] **Types inattendus** : `{"email":{"$ne":1}}`, mot de passe en tableau, JSON malformé, chaînes très longues. *Attendu : 400, jamais 500 avec trace.*
- [ ] **Inscription** : création de comptes en masse, rôle imposé dans le corps de la requête (`role: "admin"`).

### 2.2 Sessions et jetons (JWT)
- [ ] `alg: none`, charge utile modifiée (autre `sub`, `role: super_admin`), secret faible (`secret`, `changeme`), jeton expiré. *Attendu : refusés partout, y compris dans le middleware/proxy.*
- [ ] Algorithme **épinglé** à la vérification (`algorithms: ['HS256']`).
- [ ] Le rôle et le compte sont **relus en base** à chaque requête (compte suspendu ou supprimé = session morte), et non tirés du jeton.
- [ ] Cookie : `HttpOnly`, `Secure` en production, `SameSite=Lax` ou `Strict`, durée raisonnable.

### 2.3 Contrôle d'accès (le plus rentable à tester)
- [ ] **IDOR** : avec le compte A, appeler chaque route `[id]` (GET, PATCH, DELETE) avec les identifiants de B. *Attendu : 404/403.*
- [ ] **Multi-organisation / multi-client** : **références croisées**. Créer chez A une ligne qui pointe vers un identifiant de B (`*_id`), puis la relire **avec jointure / expansion** (`select=*,relation(*)`, GraphQL, `include`). *C'est la faille critique trouvée sur OptiWifi.* Les jointures doivent être filtrées par organisation et les références vérifiées à l'écriture.
- [ ] **Escalade verticale** : chaque route d'écriture et d'admin, appelée avec chaque rôle inférieur (collecteur, lecture seule, client, etc.).
- [ ] **Auto-promotion** : un utilisateur qui modifie son propre profil (`role`, `organization_id`, `is_admin`, `pos_id`…).
- [ ] **Back-office / super admin** : toutes les routes `/platform`, `/admin`, avec un compte client.
- [ ] **Routes de debug et de test** (`debug`, `test-*`, `ping`, `health`) : qui peut les appeler ? Que renvoient-elles (tables, variables, données) ?
- [ ] **Passerelle générique vers la base** (type `/api/db`, PostgREST, Supabase client) : liste blanche des tables, actions et colonnes ; filtre d'organisation **forcé côté serveur** ; filtres `OR` qui pourraient sortir de ce filtre ; mise à jour ou suppression sans filtre.
- [ ] Organisation suspendue, abonnement expiré, compte en lecture seule : les écritures sont-elles bien bloquées **côté serveur** ?

### 2.4 Injections
- [ ] **SQL** : chercher toute concaténation (`` `...${x}...` `` dans une requête, y compris `LIMIT`, `OFFSET`, `ORDER BY`, noms de table et de colonne, `INTERVAL`). Injecter `'`, `"`, `;`, `--`, `) OR 1=1`, `0; select 1` dans **chaque** champ, y compris les nombres (`limit`, `range`, `page`).
- [ ] Les identifiants dynamiques sont validés (`^[a-zA-Z_][a-zA-Z0-9_]*$`) **et** mis entre guillemets ; les valeurs sont **toujours** paramétrées (`$1`).
- [ ] **XSS** : `dangerouslySetInnerHTML`, `innerHTML`, Markdown ou HTML rendus, noms et commentaires affichés ; e-mails HTML construits avec des données saisies par l'utilisateur (échapper `< > & "`).
- [ ] **Injection de consignes (IA)** : un bot ou agent qui lit des données saisies par des clients et possède des outils (SQL, déploiement, envoi de messages). *Attendu : outils en lecture seule ou avec confirmation, tables sensibles exclues, aucun secret transmis au fournisseur d'IA.*
- [ ] **Commandes, chemins** : `exec`/`spawn` avec des entrées ; noms de fichiers (`../`).

### 2.5 Exposition de données et configuration
- [ ] Messages d'erreur : jamais de texte SQL brut, de trace de pile, de nom de table ou de chemin renvoyé au client en production.
- [ ] Réponses API : pas de hash de mot de passe, de jetons, de champs internes (`notes`, `app_metadata`), ni de données d'un autre rôle.
- [ ] Fichiers sensibles servis ? `/.env`, `/.env.local`, `/.git/config`, `/api/../.env`, cartes de source (`.map`) en production.
- [ ] En-têtes : `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` ou `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy`, une CSP, pas de `X-Powered-By`. Pour les API : `Cache-Control: no-store`.
- [ ] **CSRF** : requête d'écriture avec `Origin: https://evil.com`. *Attendu : 403.* Vérifier aussi le comportement sans `Origin` ni `Referer`.
- [ ] **Redirections ouvertes** : `?redirect=https://evil.com`, `?next=//evil.com`.
- [ ] **CORS** : `Access-Control-Allow-Origin: *` avec cookies ?

### 2.6 Secrets
- [ ] Recherche dans le code et l'historique Git : `sk_live`, `sk_test`, `AKIA`, `AIza`, `api_key`, `Bearer `, `password`, `secret`, `BEGIN .* PRIVATE KEY`, `postgres://`, `mysql://`, `mongodb://`.
  `git log -p | grep -nE "sk_live|AKIA|BEGIN .*PRIVATE KEY|postgres(ql)?://[^:]+:[^@]+@"`
- [ ] `.env*` ignorés par Git (`git check-ignore -v .env.local`) et jamais commités (`git log --all -- .env*`).
- [ ] **Secrets de production sur les postes** (`.env.production`, `vercel env pull`) : à supprimer ; jetons de plateforme (`VERCEL_TOKEN`…) à révoquer s'ils traînent.
- [ ] Secrets distincts par environnement (dev, preview, production) ; aucun secret dans une variable `NEXT_PUBLIC_*`.
- [ ] Garde-fou : un environnement de dev ou de preview **ne peut pas** se connecter à la base de production, et un build de production local non plus.

### 2.7 Intégrations
- [ ] **Webhooks** (Telegram, Stripe, Vercel…) : signature ou secret vérifié en temps constant ; appel sans secret refusé ; fermé par défaut si le secret manque.
- [ ] **Crons** : `Authorization: Bearer <CRON_SECRET>` exigé ; appel sans secret = 401.
- [ ] Routes qui consomment des crédits payants (IA, SMS, e-mail) : réservées et limitées.
- [ ] **Uploads** : type et taille vérifiés côté serveur, pas d'exécution, pas de SVG servi avec du script, stockage hors du dossier public.

### 2.8 Disponibilité (déni de service applicatif)
- [ ] Requêtes sans limite de lignes (`limit` absent ou énorme) ; plafond côté serveur.
- [ ] Opérations coûteuses déclenchables sans limite : bcrypt sur la connexion, envoi d'e-mails, export, IA.
- [ ] Corps de requête énormes, JSON très imbriqué.

---

## 3. Test de charge

- Le faire sur un **build de production** (`next build` puis start), jamais sur le serveur de dev, et sur la **base de dev**.
- Paliers d'utilisateurs simultanés : **10 → 50 → 100 → 200 → 400**, 10 à 15 s par palier, sur :
  1. un endpoint sans base (référence) ;
  2. une page publique ;
  3. les 2 ou 3 endpoints authentifiés les plus lourds (tableau de bord, liste avec jointures) ;
  4. une **rafale** de 300 à 600 requêtes lancées d'un coup.
- Mesurer : req/s, médiane, p95, p99, **taux d'erreur** et type d'erreur (5xx serveur ≠ connexion refusée ≠ timeout).
- Vérifier que le serveur **répond encore** juste après la rafale.
- Interpréter honnêtement : en local, la latence vers une base distante et la file TCP du système faussent les chiffres. En serverless, la limite réelle est souvent la **base** (connexions, taille de calcul).
- Script minimal (Node 18+) :

```js
// node load.mjs <url> <paliers ex: 10,50,100> <secondes>
const [url, levels, secs = 12] = process.argv.slice(2);
for (const vus of levels.split(',').map(Number)) {
  const lat = []; let ok = 0, err = 0; const end = Date.now() + secs * 1000;
  await Promise.all(Array.from({ length: vus }, async () => {
    while (Date.now() < end) {
      const s = performance.now();
      try { const r = await fetch(url); await r.arrayBuffer(); r.status < 500 ? ok++ : err++; } catch { err++; }
      lat.push(performance.now() - s);
    }
  }));
  lat.sort((a, b) => a - b);
  const p = (q) => Math.round(lat[Math.floor(lat.length * q)] || 0);
  console.log(`vus=${vus} req/s=${Math.round((ok + err) / secs)} p50=${p(.5)}ms p95=${p(.95)}ms erreurs=${(100 * err / (ok + err)).toFixed(1)}%`);
}
```

---

## 4. Grille de gravité

| Gravité | Définition | Délai de correction |
|---|---|---|
| 🔴 **Critique** | Accès aux données d'un autre client, prise de contrôle de compte sans interaction, exécution de code ou SQL arbitraire, secret de production exposé | Immédiat, avant tout déploiement |
| 🟠 **Élevée** | Prise de compte avec une condition (session volée), force brute possible, escalade de rôle | Sous 48 h |
| 🟡 **Moyenne** | Fuite d'informations techniques, debug ouvert, sessions non révoquées, injection bloquée « par chance » | Sous 2 semaines |
| 🔵 **Faible** | En-têtes manquants, énumération, spam limité | Prochaine version |
| ⚪ **Info** | Bonne pratique, contrepartie acceptée, décision à prendre | À arbitrer |

---

## 5. Modèle de rapport

```markdown
# Rapport de test d'intrusion — <Projet> — <JJ/MM/AAAA>
Périmètre · Environnement (base utilisée !) · Méthode · Comptes de test · Nettoyage

## 1. Synthèse        (tableau gravité / trouvées / corrigées + la faille la plus grave en 2 lignes)
## 2. Failles         (pour chacune : Attaque · Preuve · Cause · Correction · Vérifié)
## 3. Points à décider
## 4. Attaques tentées sans succès (défenses confirmées)
## 5. Test de charge  (tableau + lecture des résultats + pistes)
## 6. Fichiers modifiés, migrations éventuelles, résultat tsc / lint / build
```

---

## 6. Avant de déclarer « terminé »

- [ ] Chaque faille corrigée a été **ré-attaquée** avec le même script, et le résultat est consigné.
- [ ] Les parcours normaux de **chaque rôle** fonctionnent toujours (au minimum les requêtes réellement utilisées par l'interface).
- [ ] `tsc --noEmit` sans erreur, `eslint` sans nouvelle erreur, build de production réussi.
- [ ] Aucune migration de base oubliée ; si une migration est nécessaire, elle est idempotente, testée sur dev, et la production est sauvegardée avant.
- [ ] Données et comptes de test supprimés ; journaux d'erreurs pollués par le test nettoyés.
- [ ] Aucun secret dans le diff (`git diff | grep -nE "sk_|AKIA|BEGIN .*PRIVATE|postgres(ql)?://"`).
- [ ] Rapport rédigé, points « à décider » remontés au propriétaire du projet.
