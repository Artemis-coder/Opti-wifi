import { NextRequest, NextResponse } from 'next/server';
import { notifyBuild } from '@/lib/telegram';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

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