<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

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

