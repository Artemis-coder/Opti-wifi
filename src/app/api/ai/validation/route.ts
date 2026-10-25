import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, AUTH_COOKIE_NAME } from '@/lib/neon/auth';

interface PendingValidation {
  id: string;
  project: string;
  step: string;
  message: string;
  context: string;
  timestamp: number;
  status: 'pending' | 'approved' | 'rejected' | 'instructions';
  response?: string;
}

const pendingValidations = new Map<string, PendingValidation>();

export function createValidationRequest(data: {
  project: string;
  step: string;
  message: string;
  context: string;
}): PendingValidation {
  const id = `val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const validation: PendingValidation = {
    id,
    project: data.project,
    step: data.step,
    message: data.message,
    context: data.context,
    timestamp: Date.now(),
    status: 'pending',
  };
  pendingValidations.set(id, validation);
  return validation;
}

export function getValidation(id: string): PendingValidation | undefined {
  return pendingValidations.get(id);
}

export function updateValidation(id: string, status: PendingValidation['status'], response?: string) {
  const validation = pendingValidations.get(id);
  if (validation) {
    validation.status = status;
    if (response) validation.response = response;
    return validation;
  }
  return null;
}

export function getPendingValidations(): PendingValidation[] {
  return Array.from(pendingValidations.values()).filter(v => v.status === 'pending');
}

export function clearOldValidations(maxAgeMs = 24 * 60 * 60 * 1000) {
  const now = Date.now();
  for (const [id, v] of pendingValidations.entries()) {
    if (now - v.timestamp > maxAgeMs) {
      pendingValidations.delete(id);
    }
  }
}

/** Vérifie l'authentification et renvoie le payload JWT ou null. */
function requireAuth(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: NextRequest) {
  const payload = requireAuth(request);
  if (!payload) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (id) {
    const validation = getValidation(id);
    if (!validation) {
      return NextResponse.json({ error: 'Validation introuvable.' }, { status: 404 });
    }
    return NextResponse.json(validation);
  }

  clearOldValidations();
  return NextResponse.json({ validations: getPendingValidations() });
}

export async function POST(request: NextRequest) {
  const payload = requireAuth(request);
  if (!payload) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, id, response } = body;

    if (action === 'respond' && id) {
      const validation = updateValidation(id, 'instructions', response);
      if (validation) {
        return NextResponse.json({ ok: true, validation });
      }
      return NextResponse.json({ error: 'Validation introuvable.' }, { status: 404 });
    }

    if (action === 'create') {
      const validation = createValidationRequest(body);
      return NextResponse.json({ ok: true, validation });
    }

    return NextResponse.json({ error: 'Action invalide.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}