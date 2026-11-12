'use client';

import React, { useState } from 'react';
import { Eye, KeyRound, Loader2, Mail, Phone, Trash2, UserPlus } from 'lucide-react';
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

interface PosAccessCardProps {
  pos: { id: string; nom: string; telephone?: string | null };
  /** Compte point de vente actuel (non supprimé), ou null. */
  account: Profile | null;
  onChanged: (account: Profile | null) => void;
}

/**
 * Fiche du point de vente (administrateur) : accès en consultation seule pour le point de vente.
 * Il y verra uniquement les allocations reçues et les collectes faites chez lui.
 */
export function PosAccessCard({ pos, account, onChanged }: PosAccessCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [nom, setNom] = useState(pos.nom);
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState(pos.telephone || '');
  const [motDePasse, setMotDePasse] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [created, setCreated] = useState<{ member: Profile; access: MemberAccessInfo; emailSent: boolean } | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

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
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Accès du point de vente</h3>
            <p className="text-xs text-slate-500">
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
            <p className="font-semibold text-slate-900 dark:text-white">{account.nom}</p>
            {account.telephone && (
              <p className="flex items-center gap-1 text-xs text-slate-500">
                <Phone className="w-3 h-3" /> {account.telephone} <span className="text-slate-400">(identifiant de connexion)</span>
              </p>
            )}
            {!isInternalPosAccountEmail(account.email) && (
              <p className="flex items-center gap-1 text-xs text-slate-500">
                <Mail className="w-3 h-3" /> {account.email}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <WriteButton variant="outline" size="sm" className="h-10 font-semibold" onClick={() => setManageOpen(true)}>
              <KeyRound className="w-4 h-4 mr-1.5" /> Gérer l’accès
            </WriteButton>
            <WriteButton
              variant="outline"
              size="sm"
              className="h-10 font-semibold text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-900/60 dark:hover:bg-red-900/30"
              onClick={remove}
            >
              <Trash2 className="w-4 h-4 mr-1.5" /> Retirer
            </WriteButton>
          </div>
        </div>
      ) : (
        <WriteButton size="sm" className="h-10 font-semibold" onClick={() => setIsOpen(true)}>
          <UserPlus className="w-4 h-4 mr-1.5" /> Créer un accès
        </WriteButton>
      )}

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={`Créer un accès pour ${pos.nom}`}>
        <form onSubmit={create} className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
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
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="w-4 h-4 accent-brand-600"
            />
            Envoyer les accès par e-mail
          </label>
          )}
          <div className="flex justify-end gap-2">
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

      <MemberAccessDialog member={manageOpen ? account : null} onClose={() => setManageOpen(false)} />
    </Card>
  );
}
