import { NextRequest, NextResponse } from 'next/server';
import { notifyBuild } from '@/lib/telegram';
import { isVercelWebhookSigned } from '@/lib/telegram-auth';

export async function POST(request: NextRequest) {
  // Seuls les webhooks signés par Vercel (VERCEL_WEBHOOK_SECRET) sont acceptés
  const rawBody = await request.text();
  if (!isVercelWebhookSigned(rawBody, request.headers.get('x-vercel-signature'))) {
    return NextResponse.json({ error: 'Signature invalide' }, { status: 403 });
  }
  try {
    const payload = JSON.parse(rawBody);

    if (payload.type !== 'deployment') {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const deployment = payload.payload;
    const status = deployment.state === 'READY' ? 'success' 
      : deployment.state === 'ERROR' ? 'failed' 
      : 'building';

    await notifyBuild({
      project: deployment.projectName || 'OptiWifi',
      status,
      url: deployment.url || `https://vercel.com/${deployment.projectName}`,
      commit: deployment.commitSha,
      branch: deployment.gitBranch,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Vercel webhook error:', error);
    return NextResponse.json({ error: 'Erreur traitement webhook' }, { status: 500 });
  }
}