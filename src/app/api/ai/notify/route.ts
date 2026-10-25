import { NextRequest, NextResponse } from 'next/server';
import { isInternalOrSuperAdmin } from '@/lib/telegram-auth';
import { notifyCustom, notifyError } from '@/lib/telegram';

/**
 * Endpoint d'envoi de notifications Telegram.
 * Requiert une authentification valide pour éviter le spam.
 */
export async function POST(request: NextRequest) {
  // ── Authentification : appel interne (Bearer CRON_SECRET) ou super admin ──
  if (!(await isInternalOrSuperAdmin(request))) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { type, ...data } = body;

    let success = false;

    switch (type) {
      case 'validation_needed':
        success = await notifyCustom({
          title: '🤖 Validation Requise',
          message: data.message || 'L\'IA a besoin de votre validation pour continuer',
          emoji: '⏳',
          fields: {
            'Projet': data.project || 'OptiWifi',
            'Étape': data.step || 'Non spécifiée',
            'Contexte': data.context || 'Développement en cours',
          },
          url: data.url,
          urlText: data.urlText || 'Voir le projet',
        });
        break;

      case 'validation_done':
        success = await notifyCustom({
          title: '✅ Validation Reçue',
          message: data.message || 'Validation reçue, reprise du travail',
          emoji: '✅',
          fields: {
            'Projet': data.project || 'OptiWifi',
            'Action': data.action || 'Continuer',
          },
        });
        break;

      case 'task_complete':
        success = await notifyCustom({
          title: '🎉 Tâche Terminée',
          message: data.message || 'La tâche a été complétée avec succès',
          emoji: '🎉',
          fields: {
            'Projet': data.project || 'OptiWifi',
            'Tâche': data.task || 'Non spécifiée',
            'Durée': data.duration || 'N/A',
          },
        });
        break;

      case 'blocker':
        success = await notifyError({
          source: data.source || 'Développement IA',
          error: data.error || 'Bloquant détecté',
          severity: 'high',
          context: {
            project: data.project || 'OptiWifi',
            step: data.step,
            details: data.details,
          },
        });
        break;

      default:
        return NextResponse.json({ error: 'Type de notification inconnu.' }, { status: 400 });
    }

    return NextResponse.json({ ok: success });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}