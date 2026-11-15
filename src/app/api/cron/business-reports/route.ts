import { NextResponse } from 'next/server';
import { hydrateTelegramEnv } from '@/lib/integration-secrets';
import { reportSecurityEvent } from '@/lib/security-events';
import { recordCronRun } from '@/lib/system-errors';
import { sendBotMessage } from '@/lib/bot/assistant';
import { collectionAnomalies, morningReport, riskClients, weeklyReport } from '@/lib/business-reports';

// Rapports business sur Telegram (cron quotidien, voir vercel.json) :
// - chaque jour : rapport du matin + anomalies d'encaissement (seulement s'il y en a)
// - le lundi : en plus, clients à risque (s'il y en a) et bilan de la semaine
// ?report=morning|anomalies|risk|weekly envoie un seul rapport (test manuel, même secret).
const REPORTS = { morning: morningReport, anomalies: collectionAnomalies, risk: riskClients, weekly: weeklyReport } as const;
type ReportName = keyof typeof REPORTS;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'Endpoint non configuré.' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    reportSecurityEvent({ type: 'webhook_bad_secret', request, detail: 'Cron appelé sans le bon secret' });
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const startedAt = Date.now();
  const only = new URL(request.url).searchParams.get('report');
  if (only && !(only in REPORTS)) return NextResponse.json({ error: 'report inconnu' }, { status: 400 });
  const monday = new Date().getUTCDay() === 1; // Africa/Abidjan = UTC
  const names: ReportName[] = only ? [only as ReportName] : ['morning', 'anomalies', ...(monday ? (['risk', 'weekly'] as const) : [])];

  try {
    await hydrateTelegramEnv();
    const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
    if (!chatId) throw new Error('TELEGRAM_CHAT_ID manquant');
    const sent: string[] = [];
    for (const name of names) {
      const text = await REPORTS[name]();
      if (!text) continue; // rien à signaler : pas de message
      await sendBotMessage(chatId, text);
      sent.push(name);
    }
    if (!only) await recordCronRun('business-reports', true, `Rapports envoyés : ${sent.join(', ') || 'aucun'}`, startedAt);
    return NextResponse.json({ ok: true, sent });
  } catch (err) {
    if (!only) await recordCronRun('business-reports', false, err instanceof Error ? err.message : 'Erreur', startedAt);
    console.error('Business reports error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Échec des rapports' }, { status: 500 });
  }
}
