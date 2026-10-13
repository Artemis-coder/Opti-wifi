import { type NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon/db';
import { signToken } from '@/lib/neon/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 });
    }

    const result = await query(
      'SELECT id, email FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json({ data: { message_id: 'sent' }, error: null });
    }

    const user = result.rows[0];
    const token = signToken({
      id: user.id,
      email: user.email,
      role: 'administrateur',
      email_confirmed: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({
      data: {
        message_id: 'sent',
        reset_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/reset-password?token=${token}`,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) || 'Internal error' }, { status: 500 });
  }
}
