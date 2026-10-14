import { NextRequest, NextResponse } from 'next/server';
import { testTelegramConnection } from '@/lib/telegram';

export async function GET() {
  const success = await testTelegramConnection();
  return NextResponse.json({ 
    ok: success, 
    message: success ? 'Message de test envoyé !' : 'Échec - vérifiez TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID' 
  });
}