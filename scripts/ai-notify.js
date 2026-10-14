#!/usr/bin/env node

/**
 * Script CLI pour envoyer des notifications Telegram pendant le développement
 * Usage: node scripts/ai-notify.js <type> [options]
 * 
 * Types: validation_needed, validation_done, task_complete, blocker
 */

const fetch = require('node-fetch');

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const ENDPOINT = `${BASE_URL}/api/ai/notify`;

async function sendNotification(type, data) {
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...data }),
    });
    
    const result = await response.json();
    if (result.ok) {
      console.log(`✅ Notification "${type}" envoyée`);
    } else {
      console.error(`❌ Erreur: ${result.error}`);
    }
  } catch (error) {
    console.error(`❌ Erreur réseau: ${error.message}`);
  }
}

const args = process.argv.slice(2);
const type = args[0];

if (!type) {
  console.log(`
Usage: node scripts/ai-notify.js <type> [options]

Types:
  validation_needed  - Demander validation (message, project, step, context, url)
  validation_done    - Confirmer validation reçue (message, project, action)
  task_complete      - Tâche terminée (message, project, task, duration)
  blocker            - Bloquant détecté (error, project, step, details)

Exemples:
  node scripts/ai-notify.js validation_needed --message="Valider le design API" --step="API Design"
  node scripts/ai-notify.js task_complete --task="Authentification" --duration="45min"
  node scripts/ai-notify.js blocker --error="Migration DB échouée" --step="Migration"
`);
  process.exit(1);
}

const data = {};
for (let i = 1; i < args.length; i += 2) {
  const key = args[i].replace(/^--/, '');
  data[key] = args[i + 1];
}

sendNotification(type, data);