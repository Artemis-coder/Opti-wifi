import { NextRequest, NextResponse } from 'next/server';
import { notifyBuild, notifyDatabaseAlert, notifyError, notifyCustom } from '@/lib/telegram';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, ...data } = body;

    let success = false;

    switch (type) {
      case 'build':
        success = await notifyBuild(data);
        break;
      case 'database':
        success = await notifyDatabaseAlert(data);
        break;
      case 'error':
        success = await notifyError(data);
        break;
      case 'custom':
        success = await notifyCustom(data);
        break;
      default:
        return NextResponse.json({ error: 'Type de notification inconnu' }, { status: 400 });
    }

    if (success) {
      return NextResponse.json({ ok: true });
    } else {
      return NextResponse.json({ error: 'Échec envoi Telegram' }, { status: 500 });
    }
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}