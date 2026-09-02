#!/usr/bin/env bash
# ============================================================
# OPTIWIFI - Script de sauvegarde/restauration de la base de données
# ============================================================
# Wrapper autour de backup.js pour simplifier l'usage
#
# Usage:
#   ./scripts/backup.sh                    # Sauvegarde
#   ./scripts/backup.sh --restore=fichier  # Restauration
#   ./scripts/backup.sh --list             # Liste les sauvegardes
#   ./scripts/backup.sh --clean=7          # Supprime sauvegardes > 7 jours
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Charger les variables d'environnement
ENV_FILE="${PROJECT_DIR}/.env.local"
if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

# Executer le script Node.js
node "${SCRIPT_DIR}/backup.js" "$@"
