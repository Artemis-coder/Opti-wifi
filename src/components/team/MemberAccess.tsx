'use client';

import React, { useState } from 'react';
import { Check, Copy, KeyRound, Mail, MessageCircle, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';

export interface MemberAccessInfo {
  email: string;
  temporary_password: string;
  login_url: string;
}

interface Member {
  id: string;
  nom: string;
  email: string;
  telephone?: string | null;
}

function shareText(name: string, a: MemberAccessInfo): string {
  return [
    `Bonjour ${name}, voici vos accès OptiSpace :`,
    `• Adresse : ${a.login_url}`,
    `• E-mail : ${a.email}`,
    `• Mot de passe temporaire : ${a.temporary_password}`,
    'À la première connexion, vous choisirez votre propre mot de passe.',
  ].join('\n');
}

function CopyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <p className={cn('text-sm font-semibold text-slate-900 dark:text-white break-all', mono && 'font-mono text-base')}>{value}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="shrink-0 inline-flex items-center gap-1 h-9 px-3 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
        aria-label={`Copier ${label}`}
      >
        {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
        {copied ? 'Copié' : 'Copier'}
      </button>
    </div>
  );
}

/** Fiche des accès d'un membre : à transmettre maintenant (le mot de passe n'est plus affiché ensuite). */
export function AccessCard({ member, access, emailSent }: { member: Member; access: MemberAccessInfo; emailSent: boolean }) {
  const text = shareText(member.nom, access);
  const phone = (member.telephone || '').replace(/\D/g, '');
  const whatsapp = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

  return (
    <div className="space-y-4 text-left">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 px-4 divide-y divide-slate-100 dark:divide-slate-800">
        <CopyRow label="Adresse de connexion" value={access.login_url} />
        <CopyRow label="E-mail" value={access.email} />
        <CopyRow label="Mot de passe temporaire" value={access.temporary_password} mono />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 font-semibold"
          onClick={() => navigator.clipboard.writeText(text).then(() => toast.success('Accès copiés : collez-les dans un message.'))}
        >
          <Copy className="w-4 h-4 mr-1.5" /> Copier tous les accès
        </Button>
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="h-11 inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white bg-[#128C7E] hover:bg-[#0e7268]"
        >
          <MessageCircle className="w-4 h-4" /> Envoyer sur WhatsApp
        </a>
      </div>

      <p
        className={cn(
          'flex items-start gap-2 rounded-xl px-3 py-2 text-xs',
          emailSent
            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
        )}
      >
        <Mail className="w-4 h-4 shrink-0 mt-0.5" />
        {emailSent
          ? `Les accès ont aussi été envoyés par e-mail à ${access.email}.`
          : 'Aucun e-mail envoyé : transmettez ces accès par WhatsApp ou copiez-les.'}
      </p>

      <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
        Ce mot de passe ne sera plus affiché. En cas d&apos;oubli, utilisez le bouton « Accès » du membre pour lui en
        donner un nouveau. Il choisira son propre mot de passe à la première connexion.
      </p>
    </div>
  );
}

/** Lien « choisir mon mot de passe » à transmettre (copie, WhatsApp) ; e-mail en plus si envoyé. */
export function InviteLinkCard({ member, link, emailSent }: { member: Member; link: string; emailSent: boolean }) {
  const text = [
    `Bonjour ${member.nom}, voici votre lien pour choisir votre mot de passe OptiSpace (valable 7 jours) :`,
    link,
    `Ensuite, connectez-vous avec votre e-mail : ${member.email}`,
  ].join('\n');
  const phone = (member.telephone || '').replace(/\D/g, '');
  return (
    <div className="space-y-4 text-left">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 px-4 divide-y divide-slate-100 dark:divide-slate-800">
        <CopyRow label="Lien pour choisir son mot de passe" value={link} />
        <CopyRow label="E-mail de connexion" value={member.email} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 font-semibold"
          onClick={() => navigator.clipboard.writeText(text).then(() => toast.success('Message copié : collez-le dans une conversation.'))}
        >
          <Copy className="w-4 h-4 mr-1.5" /> Copier le message
        </Button>
        <a
          href={`https://wa.me/${phone}?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="h-11 inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white bg-[#128C7E] hover:bg-[#0e7268]"
        >
          <MessageCircle className="w-4 h-4" /> Envoyer sur WhatsApp
        </a>
      </div>
      <p
        className={cn(
          'flex items-start gap-2 rounded-xl px-3 py-2 text-xs',
          emailSent
            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
        )}
      >
        <Mail className="w-4 h-4 shrink-0 mt-0.5" />
        {emailSent ? `Le lien a aussi été envoyé par e-mail à ${member.email}.` : 'Aucun e-mail envoyé : transmettez le lien par WhatsApp ou copiez-le.'}
      </p>
      <p className="text-xs text-slate-500">
        Le lien ne sert qu&apos;une fois. Son mot de passe actuel reste valable jusqu&apos;à ce qu&apos;il en choisisse un nouveau.
      </p>
    </div>
  );
}

/**
 * « Accès » d'un membre existant : lien par e-mail pour choisir son mot de passe, ou
 * nouveau mot de passe temporaire à transmettre (copie, WhatsApp, e-mail).
 */
export function MemberAccessDialog({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const [busy, setBusy] = useState<'invite_link' | 'temporary_password' | null>(null);
  const [alsoEmail, setAlsoEmail] = useState(true);
  const [linkByEmail, setLinkByEmail] = useState(true);
  const [result, setResult] = useState<
    { kind: 'password'; access: MemberAccessInfo; emailSent: boolean } | { kind: 'link'; link: string; emailSent: boolean } | null
  >(null);

  const close = () => {
    setResult(null);
    onClose();
  };

  const run = async (action: 'invite_link' | 'temporary_password') => {
    if (!member) return;
    setBusy(action);
    try {
      const res = await fetch(`/api/users/${member.id}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, send_email: action === 'temporary_password' ? alsoEmail : linkByEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Action impossible.');
        return;
      }
      if (action === 'invite_link') {
        setResult({ kind: 'link', link: data.link, emailSent: data.email_sent === true });
      } else {
        setResult({ kind: 'password', access: data.access, emailSent: data.email_sent === true });
      }
    } catch {
      toast.error('Erreur réseau.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      isOpen={!!member}
      onClose={close}
      title={
        result?.kind === 'link'
          ? `Lien pour ${member?.nom}`
          : result
            ? `Nouveaux accès de ${member?.nom}`
            : `Accès de ${member?.nom ?? ''}`
      }
    >
      {member && result ? (
        <div className="space-y-4">
          {result.kind === 'link' ? (
            <InviteLinkCard member={member} link={result.link} emailSent={result.emailSent} />
          ) : (
            <AccessCard member={member} access={result.access} emailSent={result.emailSent} />
          )}
          <div className="flex justify-end">
            <Button onClick={close}>Terminé</Button>
          </div>
        </div>
      ) : (
        member && (
          <div className="space-y-4 text-left">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Les mots de passe ne sont pas conservés en clair : on ne peut pas retrouver les anciens accès, mais
              vous pouvez en redonner à <strong>{member.nom}</strong> ({member.email}).
            </p>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
              <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-brand-600" /> Lui envoyer un lien pour choisir son mot de passe
              </p>
              <p className="text-xs text-slate-500">
                Il choisit lui-même son mot de passe (lien valable 7 jours). Vous transmettez le lien par WhatsApp ou en
                le copiant ; son mot de passe actuel reste valable d&apos;ici là.
              </p>
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={linkByEmail} onChange={(e) => setLinkByEmail(e.target.checked)} className="w-4 h-4 accent-brand-600" />
                L&apos;envoyer aussi par e-mail
              </label>
              <Button variant="outline" className="w-full h-10 font-semibold" isLoading={busy === 'invite_link'} disabled={!!busy} onClick={() => run('invite_link')}>
                Créer le lien
              </Button>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
              <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-600" /> Générer un nouveau mot de passe temporaire
              </p>
              <p className="text-xs text-slate-500">
                L&apos;ancien mot de passe ne fonctionnera plus. Vous transmettez les nouveaux accès (copie, WhatsApp) ;
                il choisira son mot de passe à la connexion.
              </p>
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={alsoEmail} onChange={(e) => setAlsoEmail(e.target.checked)} className="w-4 h-4 accent-brand-600" />
                Les envoyer aussi par e-mail
              </label>
              <Button className="w-full h-10 font-semibold" isLoading={busy === 'temporary_password'} disabled={!!busy} onClick={() => run('temporary_password')}>
                Générer et afficher les accès
              </Button>
            </div>
          </div>
        )
      )}
    </Modal>
  );
}
