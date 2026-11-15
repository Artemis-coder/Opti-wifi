import { NextResponse } from 'next/server';
import { isDevAgentRequest } from '@/lib/dev-agent-auth';
import { getDevRequest } from '@/lib/dev-requests';

type Params = { params: Promise<{ id: string }> };

// Lecture d'une demande de développement par la routine Claude Code (jeton DEV_AGENT_TOKEN).
export async function GET(request: Request, { params }: Params) {
  if (!isDevAgentRequest(request)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  const { id } = await params;
  const r = await getDevRequest(Number(id));
  if (!r) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });
  return NextResponse.json({ request: r });
}
