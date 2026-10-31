import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

let transporter: Transporter | null = null;

/** Vrai si l'envoi d'e-mails est configuré (SMTP) */
export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter(): Transporter {
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

    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
    const fromName = process.env.SMTP_FROM_NAME || 'OptiSpace';

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    return { success: true, messageId: info.messageId };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Email sending failed:', error);
    return { success: false, error: message };
  }
}

// ── Modèles d'e-mails ──────────────────────────────────────────────────────

const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Mise en page commune : bandeau OptiSpace, contenu, bouton, pied de page */
function layout(opts: { title: string; body: string; button?: { label: string; url: string }; footer: string }): string {
  const button = opts.button
    ? `<div style="text-align:center;margin:28px 0;">
         <a href="${opts.button.url}" style="background:#1b3f2b;color:#ffffff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block;">${esc(opts.button.label)}</a>
       </div>
       <p style="font-size:13px;color:#6c757d;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
         <a href="${opts.button.url}" style="color:#1b3f2b;word-break:break-all;">${opts.button.url}</a></p>`
    : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:linear-gradient(135deg,#1b3f2b 0%,#2d5a3d 100%);padding:26px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:26px;">OptiSpace</h1>
    </div>
    <div style="background:#f8f9fa;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e9ecef;border-top:none;">
      <h2 style="color:#1b3f2b;margin-top:0;">${esc(opts.title)}</h2>
      ${opts.body}
      ${button}
      <hr style="border:none;border-top:1px solid #dee2e6;margin:20px 0;">
      <p style="font-size:12px;color:#adb5bd;margin:0;">${opts.footer}</p>
    </div>
  </body></html>`;
}

export async function sendPasswordResetEmail(email: string, resetUrl: string, name?: string | null) {
  const hello = name ? `Bonjour ${esc(name)},` : 'Bonjour,';
  const html = layout({
    title: 'Réinitialisation de votre mot de passe',
    body: `<p>${hello}</p>
      <p>Vous avez demandé à réinitialiser le mot de passe de votre compte OptiSpace (${esc(email)}).</p>
      <p>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien est valable <strong>1 heure</strong> et ne peut servir qu'une fois.</p>`,
    button: { label: 'Choisir un nouveau mot de passe', url: resetUrl },
    footer: "Vous n'avez pas fait cette demande ? Ignorez cet e-mail : votre mot de passe actuel reste valable.",
  });
  const text = `${name ? `Bonjour ${name},` : 'Bonjour,'}

Vous avez demandé à réinitialiser le mot de passe de votre compte OptiSpace (${email}).
Choisissez un nouveau mot de passe (lien valable 1 heure, usage unique) :
${resetUrl}

Vous n'avez pas fait cette demande ? Ignorez cet e-mail.`;
  return sendEmail({ to: email, subject: 'Réinitialisation de votre mot de passe - OptiSpace', html, text });
}

export interface InvitationEmail {
  to: string;
  name: string;
  organizationName: string;
  inviterName?: string | null;
  role: 'administrateur' | 'collecteur';
  loginUrl: string;
  /** Mot de passe temporaire à changer à la première connexion */
  temporaryPassword?: string;
  /** Ou lien pour choisir soi-même son mot de passe */
  setPasswordUrl?: string;
}

export async function sendInvitationEmail(i: InvitationEmail) {
  const roleLabel = i.role === 'administrateur' ? 'administrateur' : 'collecteur';
  const by = i.inviterName ? `${esc(i.inviterName)} vous a ajouté` : 'Vous avez été ajouté';
  const access = i.temporaryPassword
    ? `<table style="width:100%;background:#ffffff;border:1px solid #dee2e6;border-radius:10px;padding:14px;margin:18px 0;font-size:14px;">
         <tr><td style="color:#6c757d;padding:4px 0;">Adresse de connexion</td><td style="text-align:right;font-weight:600;"><a href="${i.loginUrl}" style="color:#1b3f2b;">${esc(i.loginUrl.replace(/^https?:\/\//, ''))}</a></td></tr>
         <tr><td style="color:#6c757d;padding:4px 0;">E-mail</td><td style="text-align:right;font-weight:600;">${esc(i.to)}</td></tr>
         <tr><td style="color:#6c757d;padding:4px 0;">Mot de passe temporaire</td><td style="text-align:right;font-weight:700;font-family:monospace;font-size:15px;">${esc(i.temporaryPassword)}</td></tr>
       </table>
       <p style="font-size:14px;">À votre première connexion, vous choisirez votre propre mot de passe.</p>`
    : `<p>Cliquez sur le bouton ci-dessous pour choisir votre mot de passe et activer votre accès (lien valable <strong>7 jours</strong>).</p>`;
  const html = layout({
    title: `Bienvenue dans l'équipe ${i.organizationName}`,
    body: `<p>Bonjour ${esc(i.name)},</p>
      <p>${by} comme <strong>${roleLabel}</strong> sur l'espace OptiSpace de <strong>${esc(i.organizationName)}</strong>.</p>
      ${access}`,
    button: i.temporaryPassword
      ? { label: 'Me connecter', url: i.loginUrl }
      : i.setPasswordUrl
        ? { label: 'Choisir mon mot de passe', url: i.setPasswordUrl }
        : undefined,
    footer: "Vous ne vous attendiez pas à cette invitation ? Ignorez cet e-mail ou contactez l'administrateur de votre équipe.",
  });
  const text = `Bonjour ${i.name},

${i.inviterName ? `${i.inviterName} vous a ajouté` : 'Vous avez été ajouté'} comme ${roleLabel} sur l'espace OptiSpace de ${i.organizationName}.
${
  i.temporaryPassword
    ? `Adresse : ${i.loginUrl}\nE-mail : ${i.to}\nMot de passe temporaire : ${i.temporaryPassword}\nÀ votre première connexion, vous choisirez votre propre mot de passe.`
    : `Choisissez votre mot de passe (lien valable 7 jours) : ${i.setPasswordUrl}`
}`;
  return sendEmail({ to: i.to, subject: `Vos accès OptiSpace — ${i.organizationName}`, html, text });
}

export async function sendPasswordChangedEmail(email: string) {
  const when = new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Abidjan' });
  const html = layout({
    title: 'Votre mot de passe a été modifié',
    body: `<p>Bonjour,</p>
      <p>Le mot de passe de votre compte OptiSpace (${esc(email)}) a été modifié le ${esc(when)}.</p>
      <p>Si c'est bien vous, vous n'avez rien à faire.</p>`,
    footer:
      "Ce n'est pas vous ? Utilisez « Mot de passe oublié » sur la page de connexion pour reprendre la main, puis prévenez votre administrateur.",
  });
  const text = `Le mot de passe de votre compte OptiSpace (${email}) a été modifié le ${when}. Ce n'est pas vous ? Utilisez « Mot de passe oublié » sur la page de connexion.`;
  return sendEmail({ to: email, subject: 'Mot de passe modifié - OptiSpace', html, text });
}
