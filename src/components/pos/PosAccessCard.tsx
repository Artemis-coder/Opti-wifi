'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock, Eye, KeyRound, Loader2, Lock, Mail, Phone, Trash2, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { WriteButton } from '@/components/ui/WriteButton';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { confirmAction } from '@/components/ui/ConfirmDialog';
import { AccessCard, MemberAccessDialog, type MemberAccessInfo } from '@/components/team/MemberAccess';
import type { Profile } from '@/types/database';
import { isInternalPosAccountEmail } from '@/lib/pos-account-email';
import type { PlanLimits } from '@/components/team/PlanLimitDialog';

interface PosAccessCardProps {
  pos: { id: string; nom: string; telephone?: string | null };
  /** Compte point de vente actuel (non supprimé), ou null. */
  account: Profile | null;
  onChanged: (account: Profile | null) => void;
  /** Limites du forfait (null : en chargement) : l'accès n'est créé que si le forfait l'inclut. */
  limits: PlanLimits | null;
}

/** Pourquoi le forfait ne permet pas un accès de plus (null : possible). */
function planBlock(limits: PlanLimits | null): { title: string; hint: string } | null {
  const quota = limits?.pos_accounts;
  if (!limits?.plan || !quota || quota.limit === null) return null;
  // Premier forfait (le moins cher) qui inclut l'accès point de vente
  const upgrade = limits.plans.find((p) => p.max_pos_accounts === null || p.max_pos_accounts === undefined || p.max_pos_accounts !== 0);
  const from = upgrade ? `Disponible à partir du forfait ${upgrade.name}.` : 'Passez à un forfait supérieur.';
  if (quota.limit === 0) {
    return { title: `Non inclus dans votre forfait ${limits.plan.name}`, hint: from };
  }
  if (quota.current >= quota.limit) {
    return {
      title: `Limite atteinte (${quota.current}/${quota.limit} accès)`,
      hint: 'Retirez un accès existant ou passez à un forfait supérieur.',
    };
  }
  return null;
}

/**
 * Fiche du point de vente (administrateur) : accès en consultation seule pour le point de vente.
 * Il y verra uniquement les allocations reçues et les collectes faites chez lui.
 */
export function PosAccessCard({ pos, account, onChanged, limits }: PosAccessCardProps) {
  const blocked = planBlock(limits);
  const [isOpen, setIsOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  // Rafraîchit l'état de connexion après « Gérer l'accès »
  const [manageOpenCount, setManageOpenCount] = useState(0);
  // Dernière connexion du compte, ou accès pas encore utilisés (mot de passe temporaire)
  const [status, setStatus] = useState<{ last_sign_in_at: string | null; pending_password: boolean } | null>(null);
  const accountId = account?.id ?? null;
  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    fetch('/api/users/access-status')
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        const row = (res?.data as { id: string; last_sign_in_at: string | null; pending_password: boolean }[] | undefined)?.find(
          (s) => s.id === accountId,
        );
        if (!cancelled) setStatus(row ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accountId, manageOpenCount]);
  const [submitting, setSubmitting] = useState(false);
  const [nom, setNom] = useState(pos.nom);
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState(pos.telephone || '');
  const [motDePasse, setMotDePasse] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [created, setCreated] = useState<{ member: Profile; access: MemberAccessInfo; emailSent: boolean } | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim() || telephone.replace(/\D/g, '').length < 8) {
      toast.error('Le nom et le numéro de téléphone sont obligatoires.');
      return;
    }
    if (motDePasse && motDePasse.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom,
          email,
          telephone,
          mot_de_passe: motDePasse,
          send_email: sendEmail && email.trim() !== '',
          role: 'point_de_vente',
          pos_id: pos.id,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        toast.error(result.error || 'Impossible de créer l’accès.');
        return;
      }
      onChanged(result.profile);
      setIsOpen(false);
      setMotDePasse('');
      toast.success('Accès créé : transmettez-le au point de vente.');
      if (result.access) setCreated({ member: result.profile, access: result.access, emailSent: result.email_sent === true });
    } catch {
      toast.error('Erreur réseau.');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    if (!account) return;
    const ok = await confirmAction(
      `Le point de vente « ${pos.nom} » ne pourra plus se connecter. Vous pourrez lui créer un nouvel accès avec une autre adresse e-mail.`,
      { title: 'Retirer l’accès ?', confirmLabel: 'Retirer', danger: true },
    );
    if (!ok) return;
    const res = await fetch(`/api/users/${account.id}`, { method: 'DELETE' });
    const result = await res.json().catch(() => ({}));
    if (res.ok && result.success) {
      onChanged(null);
      toast.success('Accès retiré.');
    } else {
      toast.error(result.error || 'Impossible de retirer l’accès.');
    }
  };

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-success-soft text-success-soft-foreground">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Accès du point de vente</h3>
            <p className="text-xs text-muted">
              Consultation seule : ses allocations reçues et ses collectes, rien d’autre.
            </p>
          </div>
        </div>
        {account && (
          <Badge variant={account.is_active === false ? 'neutral' : 'success'}>
            {account.is_active === false ? 'Inactif' : 'Actif'}
          </Badge>
        )}
      </div>

      {account ? (
        <div className="space-y-3">
          <div className="text-sm">
            <p className="font-semibold text-foreground">{account.nom}</p>
            {account.telephone && (
              <p className="flex items-center gap-1 text-xs text-muted">
                <Phone className="w-3 h-3" /> {account.telephone} <span className="text-muted">(identifiant de connexion)</span>
              </p>
            )}
            {!isInternalPosAccountEmail(account.email) && (
              <p className="flex items-center gap-1 text-xs text-muted">
                <Mail className="w-3 h-3" /> {account.email}
              </p>
            )}
            {status && (
              <p
                className={
                  status.pending_password
                    ? 'mt-1 flex items-center gap-1.5 text-xs font-semibold text-warning-soft-foreground'
                    : 'mt-1 flex items-center gap-1.5 text-xs text-muted'
                }
              >
                {status.pending_password ? <Clock className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5 text-success-soft-foreground" />}
                {status.pending_password
                  ? 'Accès pas encore utilisés'
                  : status.last_sign_in_at
                    ? `Dernière connexion le ${new Date(status.last_sign_in_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}`
                    : 'Jamais connecté'}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <WriteButton
              variant="outline"
              size="sm"
              className="h-10 font-semibold"
              onClick={() => setManageOpen(true)}
              disabled={account.is_active === false}
            >
              <KeyRound className="w-4 h-4 mr-1.5" /> Gérer l’accès
            </WriteButton>
            <WriteButton
              variant="outline"
              size="sm"
              className="h-10 font-semibold text-danger border-danger/30 hover:bg-danger-soft"
              onClick={remove}
            >
              <Trash2 className="w-4 h-4 mr-1.5" /> Retirer
            </WriteButton>
          </div>
          <Link
            href="/users?filtre=points-de-vente"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
          >
            <Users className="w-3.5 h-3.5" /> Voir tous les accès dans Utilisateurs &amp; équipe
          </Link>
        </div>
      ) : blocked ? (
        <div className="rounded-xl bg-warning-soft p-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
          <Lock className="w-5 h-5 shrink-0 text-warning-soft-foreground" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-warning-soft-foreground">{blocked.title}</p>
            <p className="text-xs text-warning-soft-foreground">{blocked.hint}</p>
          </div>
          <Link
            href="/subscription"
            className="inline-flex items-center gap-1 text-sm font-semibold text-warning-soft-foreground hover:underline whitespace-nowrap"
          >
            Voir les forfaits <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <WriteButton size="sm" className="h-10 font-semibold" onClick={() => setIsOpen(true)} disabled={!limits}>
          <UserPlus className="w-4 h-4 mr-1.5" /> Créer un accès
        </WriteButton>
      )}

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={`Créer un accès pour ${pos.nom}`}>
        <form onSubmit={create} className="space-y-4">
          <p className="text-sm text-muted">
            Le point de vente pourra consulter ses allocations et ses collectes (montants, écarts, commission), sans
            rien modifier. Vos notes internes ne lui sont pas montrées.
          </p>
          <Input label="Nom affiché" value={nom} onChange={(e) => setNom(e.target.value)} required />
          <Input
            label="Téléphone (identifiant de connexion)"
            type="tel"
            placeholder="ex: +225 07 07 07 07 07"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            helperText="Le point de vente se connectera avec ce numéro."
            required
          />
          <Input
            label="Adresse e-mail (facultatif)"
            type="email"
            placeholder="gerant@exemple.ci"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            helperText="Utile pour lui envoyer ses accès par e-mail."
          />
          <Input
            label="Mot de passe temporaire (facultatif)"
            type="text"
            placeholder="Laisser vide : généré automatiquement"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            helperText="Il choisira son propre mot de passe à sa première connexion."
            autoComplete="off"
          />
          {email.trim() !== '' && (
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="w-4 h-4 accent-brand-600"
            />
            Envoyer les accès par e-mail
          </label>
          )}
          <div className="flex gap-2 [&>*]:min-w-0 [&>*]:flex-1 [&>*]:w-full">
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Créer l’accès
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={created !== null} onClose={() => setCreated(null)} title={`Accès de ${created?.member.nom ?? ''}`}>
        {created && (
          <div className="space-y-4">
            <AccessCard member={created.member} access={created.access} emailSent={created.emailSent} />
            <div className="flex justify-end">
              <Button onClick={() => setCreated(null)}>Terminé</Button>
            </div>
          </div>
        )}
      </Modal>

      <MemberAccessDialog
        member={manageOpen ? account : null}
        onClose={() => {
          setManageOpen(false);
          setManageOpenCount((n) => n + 1);
        }}
      />
    </Card>
  );
}
