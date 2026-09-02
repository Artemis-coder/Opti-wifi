#!/usr/bin/env bash
# ============================================================
# OPTIWIFI - Cron wrapper for daily backup
# ============================================================
# Ce script est conçu pour être appelé par cron chaque jour.
# Il charge les variables d'environnement et exécute la sauvegarde.
#
# Installation du cron (exécuter une fois):
#   crontab -l 2>/dev/null; echo "0 2 * * * $(pwd)/scripts/cron_backup.sh" | crontab -
#
# Pour désinstaller:
#   crontab -l | grep -v cron_backup.sh | crontab -
# ============================================================

set -euo pipefail

# Charger les variables d'environnement depuis .env.local
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_DIR}/.env.local"

if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

# Vérifier les variables requises
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "[$(date)] ERREUR: Variables d'environnement Supabase manquantes" | tee -a "${PROJECT_DIR}/scripts/backups/cron.log"
  exit 1
fi

# Exécuter la sauvegarde
echo "[$(date)] Démarrage de la sauvegarde automatique" >> "${PROJECT_DIR}/scripts/backups/cron.log"
bash "${SCRIPT_DIR}/backup.sh" >> "${PROJECT_DIR}/scripts/backups/cron.log" 2>&1
echo "[$(date)] Sauvegarde terminée" >> "${PROJECT_DIR}/scripts/backups/cron.log"

# Nettoyer les sauvegardes plus anciennes que 30 jours
bash "${SCRIPT_DIR}/backup.sh" --clean=30 >> "${PROJECT_DIR}/scripts/backups/cron.log" 2>&1
