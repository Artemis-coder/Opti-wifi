import { type NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon/db';
import { signToken } from '@/lib/neon/auth';
import { sendPasswordResetEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 });
    }

    // Check if user exists in Neon database
    const result = await query(
      'SELECT id, email FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (!result.rows || result.rows.length === 0) {
      // Still return success to avoid email enumeration
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

    // Generate the reset URL using production domain
    const resetUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.optiwifi.site'}/reset-password?token=${token}`;

    // Send email with reset link
    await sendPasswordResetEmail(user.email, resetUrl);

    return NextResponse.json({
      data: {
        message_id: 'sent',
        reset_url: resetUrl,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) || 'Internal error' }, { status: 500 });
  }
}
