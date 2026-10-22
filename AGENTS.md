<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Workflow Git & Environnements Neon / Vercel (OBLIGATOIRE POUR TOUTE SESSION IA)

Avant toute intervention, **tout assistant de développement (agent IA ou humain) DOIT impérativement respecter les règles suivantes** :

1. **Consulter la documentation du workflow** : Lire [`docs/DEVELOPMENT_WORKFLOW.md`](file:///Users/kedakeyaoboris/Desktop/Opti%20Wifi/docs/DEVELOPMENT_WORKFLOW.md) et [`docs/ENVIRONMENT_SETUP.md`](file:///Users/kedakeyaoboris/Desktop/Opti%20Wifi/docs/ENVIRONMENT_SETUP.md) avant toute modification structurante.
2. **Vérifier l'état Git et les changements locaux** : Exécuter `git status` et inspecter les modifications locales avant toute opération. Ne jamais écraser ou réinitialiser de travail non commité.
3. **Travailler sur `develop` ou `feature/*`** : Ne JAMAIS développer, commiter ou pousser directement sur `main`. `main` est exclusivement réservé aux déploiements validés de production.
4. **Isoler la base de données (Neon DEV)** : Le développement local et les déploiements Vercel Preview doivent TOUJOURS pointer vers la base Neon de développement (`vercel-dev`, hôte `ep-crimson-shape-ayvbw15x...`).
5. **Protéger la base de production** : Ne jamais exécuter de migrations manuelles, de scripts de seed, de vidage ou d'opérations destructives sur la base de production sans autorisation explicite de l'utilisateur et sauvegarde préalable (`npm run backup`).
6. **Ne jamais exposer ni remplacer de secrets** : Ne jamais commiter de fichiers `.env*` réels dans Git. Ne jamais remplacer des secrets de production par des valeurs de test.
7. **Pas de merge automatique vers `main`** : Toute intégration vers `main` exige une validation explicite et une revue des changements.
8. **Préserver l'historique Git** : Pas de `git reset --hard` ni de push forcé sur les branches partagées. Utiliser des procédures de merge ou de fast-forward propres.
9. **Vérifier les garde-fous** : Vérifier que `src/lib/env-guard.ts` est respecté et tester l'isolation avec `/api/debug-db` sur les déploiements Preview.
10. **Demander l'autorisation préalable** : Dès qu'une opération présente un risque pour la production, une ambiguïté ou un risque de perte de données, stopper et demander confirmation à l'utilisateur.

---

# Security Guidelines

These rules are mandatory for every code change, commit, and push in this repository.

## 1. Secret Scanning (BLOCKING)

Before any commit, scan all modified and new files for:
- API keys: `sk_live`, `sk_test`, `pk_live`, `pk_test`, `AKIA`, `AIza`, `api_key`, `apikey`
- Tokens: `Bearer`, `token`, `access_token`, `refresh_token`
- Passwords / credentials: `password`, `passwd`, `secret`, `private_key`
- Cryptographic material: `BEGIN RSA PRIVATE KEY`, `BEGIN EC PRIVATE KEY`, `BEGIN PRIVATE KEY`
- Database URLs with embedded credentials: `postgres://`, `mysql://`, `mongodb://`

Never commit secrets to the repository. If a secret is found:
1. Stop immediately
2. Report the finding to the user
3. Do not commit the file until the secret is removed or rotated

## 2. SQL Injection Prevention

- Always use the Supabase ORM / parameterized queries (`.eq()`, `.neq()`, `.gt()`, `.lt()`, `.in()`, etc.)
- Never concatenate user input into raw SQL strings
- Never use `supabase.rpc()` with unsanitized dynamic SQL
- Validate and sanitize all user inputs on the client and server sides

## 3. XSS Prevention

- Never use `dangerouslySetInnerHTML` with user-controlled data
- Prefer React JSX rendering; React auto-escapes by default
- If HTML must be rendered, sanitize it first with a trusted library (e.g., DOMPurify)
- Enforce Content-Security-Policy headers where possible

## 4. Authentication & Authorization

- All protected routes must verify the user via `useAuthStore()` or Supabase Auth
- Enforce Row Level Security (RLS) in Supabase for every table
- Never rely solely on client-side checks for authorization
- Use `is_admin()` or `auth.uid()` in RLS policies; never expose admin operations to non-admin roles
- Logout must call `supabase.auth.signOut()` AND clear local auth state

## 5. Sensitive Data Handling

- Do not log passwords, tokens, API keys, or full credit card numbers
- Redact sensitive fields in error messages returned to the client
- Do not expose internal table names, schema details, or stack traces in production UI
- Use `toast.error()` for user-facing errors; log technical details server-side only

## 6. Environment Variables

- Never hardcode URLs, keys, or secrets in source files
- Use `NEXT_PUBLIC_*` only for values that are truly public (e.g., Supabase anon key)
- Validate that required env vars are present at startup (fail fast)
- Do not commit `.env.local`, `.env.production`, or any file containing secrets

## 7. Git Hygiene

- Review `git diff` and `git status` before every commit
- Never force-push (`git push --force`) unless explicitly required and approved
- Never skip hooks (`git commit --no-verify`) unless explicitly instructed
- If a secret was accidentally committed in history, report it immediately; do not attempt to rewrite history without user approval

## 8. Client-Side Data Exposure

- Do not fetch sensitive data that the current user role should not see
- Hide admin-only UI elements behind role checks (`user?.role === 'administrateur'`)
- Do not expose raw database IDs or internal references unnecessarily in the UI

## 9. Password & Auth Flows

- Use Supabase Auth methods (`signInWithPassword`, `resetPasswordForEmail`, etc.)
- Never implement custom password hashing or auth logic
- Enforce minimum password length (>= 6 chars) on the client; enforce stronger rules server-side if needed
- Redirect password reset links to a secure login page

## 10. Third-Party Dependencies

- Prefer well-maintained, audited packages
- Do not add dependencies with known critical vulnerabilities
- Run `npm audit` periodically; fix or report high/critical issues

## Pre-Commit Checklist

Before every commit, verify:
- [ ] No secrets, keys, or passwords in the diff
- [ ] No raw SQL with string concatenation
- [ ] No `dangerouslySetInnerHTML` with user data
- [ ] All new queries use ORM with proper filters (`.eq()`)
- [ ] No sensitive data in `console.log` or error messages
- [ ] RLS policies are active and tested for new tables
- [ ] Environment variables are used instead of hardcoded values
- [ ] `tsc --noEmit` passes with 0 errors
- [ ] `eslint` passes with 0 errors

## Database Backup & Restore

Manual backup script:
- `bash scripts/backup.sh` - Create a dated backup (JSON format)
- `bash scripts/backup.sh --list` - List available backups
- `bash scripts/backup.sh --restore=<filename>` - Restore from a backup file
- `bash scripts/backup.sh --clean=7` - Delete backups older than 7 days

Automatic daily backup (cron at 2 AM):
- Install cron: `echo "0 2 * * * $(pwd)/scripts/cron_backup.sh" | crontab -`

SQL migration for missing columns (must be run manually in Supabase SQL Editor):
- `supabase/fix_missing_columns.sql` - Adds space_id, updated_at, date_allocation, commission, date_collecte, devise columns and set_updated_at triggers

