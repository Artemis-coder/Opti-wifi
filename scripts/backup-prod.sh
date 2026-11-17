#!/usr/bin/env bash
# Double sauvegarde de la base de PRODUCTION avant une mise en production :
#   1. fichier JSON en lecture seule sur ce Mac (scripts/backups/, exclu de Git) ;
#   2. branche de sauvegarde Neon (copie instantanée côté Neon, sans calcul, expire après 30 jours).
# L'adresse de la base est lue depuis Vercel dans un dossier temporaire, jamais affichée, puis effacée.
set -euo pipefail
cd "$(dirname "$0")/.."

NEON_PROJECT=young-firefly-47620691   # projet opti-wifi-db
NEON_PARENT=production                # branche de production (ep-flat-term)
KEEP_DAYS=30

# --- 1. Fichier JSON local ---
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
vercel env pull "$tmp/prod.env" --environment=production --yes >/dev/null 2>&1
url=$(grep '^DATABASE_URL_UNPOOLED=' "$tmp/prod.env" | cut -d= -f2- | tr -d '"')
[ -n "$url" ] || { echo "DATABASE_URL_UNPOOLED introuvable dans l'environnement Production de Vercel" >&2; exit 1; }
echo "1/2 Fichier local"
DATABASE_URL_UNPOOLED="$url" node scripts/backup-prod-neon.mjs "${1:-scripts/backups}"

# --- 2. Branche de sauvegarde Neon ---
echo "2/2 Branche Neon"
name="backup-prod-$(date -u +%Y%m%d-%H%M)"
expires=$(date -u -v+${KEEP_DAYS}d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "+${KEEP_DAYS} days" +%Y-%m-%dT%H:%M:%SZ)
neonctl branches create --project-id "$NEON_PROJECT" --parent "$NEON_PARENT" --name "$name" \
  --no-compute --no-secrets --expires-at "$expires" --output json >/dev/null
# Vérifie que la branche existe bien, rattachée à la production
neonctl branches get "$name" --project-id "$NEON_PROJECT" --output json \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const b=JSON.parse(s);console.log(`branche: ${b.name} (${b.id}) | état: ${b.current_state} | expire le ${b.expires_at}`)})'
