#!/usr/bin/env bash
# Sauvegarde de la base de PRODUCTION (lecture seule) avant une mise en production.
# L'adresse de la base est lue depuis Vercel dans un dossier temporaire, jamais affichée, puis effacée.
set -euo pipefail
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
vercel env pull "$tmp/prod.env" --environment=production --yes >/dev/null 2>&1
url=$(grep '^DATABASE_URL_UNPOOLED=' "$tmp/prod.env" | cut -d= -f2- | tr -d '"')
[ -n "$url" ] || { echo "DATABASE_URL_UNPOOLED introuvable dans l'environnement Production de Vercel" >&2; exit 1; }
DATABASE_URL_UNPOOLED="$url" node scripts/backup-prod-neon.mjs "${1:-scripts/backups}"
