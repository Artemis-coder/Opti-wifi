import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpSecure = process.env.SMTP_SECURE === 'true';

  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error('SMTP configuration missing. Set SMTP_HOST, SMTP_USER, SMTP_PASS in environment variables.');
  }

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  return transporter;
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = getTransporter();

    const fromEmail = process.env.SMTP_FROM || smtpUser;
    const fromName = process.env.SMTP_FROM_NAME || 'OptiSpace';

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('Email sending failed:', error);
    return { success: false, error: error.message };
  }
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const subject = 'Réinitialisation de votre mot de passe - OptiSpace';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1b3f2b 0%, #2d5a3d 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">OptiSpace</h1>
      </div>
      <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e9ecef; border-top: none;">
        <h2 style="color: #1b3f2b; margin-top: 0;">Réinitialisation de mot de passe</h2>
        <p>Bonjour,</p>
        <p>Vous avez demandé la réinitialisation de votre mot de passe pour votre compte OptiSpace.</p>
        <p>Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: #1b3f2b; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
            Réinitialiser mon mot de passe
          </a>
        </div>
        <p style="font-size: 14px; color: #6c757d;">
          Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
          <a href="${resetUrl}" style="color: #1b3f2b; word-break: break-all;">${resetUrl}</a>
        </p>
        <p style="font-size: 14px; color: #6c757d;">
          Ce lien expire dans <strong>24 heures</strong> pour des raisons de sécurité.
        </p>
        <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
        <p style="font-size: 12px; color: #adb5bd; margin: 0;">
          Si vous n'avez pas demandé cette réinitialisation, ignorez cet email ou contactez le support.
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `
    Réinitialisation de votre mot de passe - OptiSpace
    
    Bonjour,
    
    Vous avez demandé la réinitialisation de votre mot de passe pour votre compte OptiSpace.
    
    Cliquez sur le lien ci-dessous pour définir un nouveau mot de passe :
    ${resetUrl}
    
    Ce lien expire dans 24 heures pour des raisons de sécurité.
    
    Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
  `;

  return sendEmail({ to: email, subject, html, text });
}