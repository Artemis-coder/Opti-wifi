'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Mail, Loader2, Trash2, Info, KeyRound, UserCheck, Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Profile, UserRole } from '@/types/database';
import { isActiveProfile } from '@/lib/utils/profiles';
import { createClient } from '@/lib/supabase/client';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { AddButton } from '@/components/ui/AddButton';
import { PlanLimitDialog, type LimitKind, type PlanLimits } from '@/components/team/PlanLimitDialog';
import { AccessCard, MemberAccessDialog, type MemberAccessInfo } from '@/components/team/MemberAccess';
import { cn } from '@/lib/utils/cn';

export default function UsersPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<Profile[]>([]);

  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('collecteur');
  const [telephone, setTelephone] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [sendEmail, setSendEmail] = useState(true);

  // Accès du membre qui vient d'être créé (affichés une seule fois)
  const [created, setCreated] = useState<{ member: Profile; access: MemberAccessInfo; emailSent: boolean } | null>(null);
  // « Accès » d'un membre existant
  const [accessMember, setAccessMember] = useState<Profile | null>(null);
  // Dernière connexion et accès pas encore utilisés (mot de passe temporaire)
  const [status, setStatus] = useState<Record<string, { last_sign_in_at: string | null; pending_password: boolean }>>({});
  const loadStatus = () =>
    fetch('/api/users/access-status')
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (!res?.data) return;
        const map: Record<string, { last_sign_in_at: string | null; pending_password: boolean }> = {};
        for (const s of res.data) map[s.id] = s;
        setStatus(map);
      })
      .catch(() => {});

  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);

  // Limites du forfait : un membre ou un collecteur de plus est-il possible ?
  const [limits, setLimits] = useState<PlanLimits | null>(null);
  const [limitKind, setLimitKind] = useState<LimitKind | null>(null);
  const isFull = (u?: { current: number; limit: number | null }) => !!u && u.limit !== null && u.current >= u.limit;
  const usersFull = isFull(limits?.users);
  const collectorsFull = isFull(limits?.collectors);

  const loadLimits = () =>
    fetch('/api/account/plan-limits')
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => res?.data && setLimits(res.data as PlanLimits))
      .catch(() => {});

  useEffect(() => {
    loadLimits();
    loadStatus();
  }, []);

  // « Ajouter » : note d'information si le forfait ne permet pas un membre de plus
  const openAdd = () => {
    if (usersFull) {
      setLimitKind('users');
      return;
    }
    if (collectorsFull) setRole('administrateur');
    setIsModalOpen(true);
  };

  const supabase = createClient();

  useEffect(() => {
    async function loadUsers() {
      setLoading(true);
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      // Les comptes supprimés disparaissent de l'équipe (leurs collectes restent dans l'historique)
      setUsers((data || []).filter(isActiveProfile));
      setLoading(false);
    }
    loadUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom || !email) {
      toast.error('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    // Vide : le serveur génère un mot de passe temporaire sûr
    if (motDePasse && motDePasse.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setIsSubmitting(true);

    const res = await fetch('/api/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, email, role, telephone, mot_de_passe: motDePasse, send_email: sendEmail }),
    });

    const result = await res.json();
    setIsSubmitting(false);

    // Limite atteinte entre-temps (contrôle serveur) : on montre les forfaits
    if (res.status === 403 && typeof result.error === 'string' && result.error.startsWith('Limite')) {
      setIsModalOpen(false);
      setLimitKind(result.error.includes('collecteurs') ? 'collectors' : 'users');
      loadLimits();
      return;
    }

    if (res.ok && result.success) {
      loadLimits();
      setUsers([result.profile, ...users]);
      toast.success('Utilisateur créé : transmettez-lui ses accès.');
      // Fiche des accès à transmettre (copie, WhatsApp, e-mail)
      if (result.access) setCreated({ member: result.profile, access: result.access, emailSent: result.email_sent === true });
      loadStatus();
      setNom('');
      setEmail('');
      setTelephone('');
      setMotDePasse('');
      setIsModalOpen(false);
    } else {
      toast.error(result.error || 'Erreur lors de la création de l\'utilisateur.');    }
  };

  const handleDeleteUser = async (user: Profile) => {
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await res.json();

    if (res.ok && result.success) {
      setUsers(users.filter((u) => u.id !== user.id));
      loadLimits();
      toast.success(result.message || 'Utilisateur supprimé avec succès.');
    } else {
      toast.error(result.error || 'Erreur lors de la suppression.');
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gestion des Utilisateurs</h1>
          <p className="text-xs text-slate-500">Profils et rôles d&apos;accès à la plateforme.</p>
        </div>
        <AddButton what="un utilisateur" onClick={openAdd} />
      </div>

      {/* Forfait : places utilisées et disponibles, bien visibles */}
      {limits?.plan && (
        <Card className="p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="lg:w-56 shrink-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Votre forfait</p>
              <p className="text-lg font-extrabold text-slate-900 dark:text-white">{limits.plan.name}</p>
              <Link href="/subscription" className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline">
                Changer de forfait <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
              {[
                { label: 'Utilisateurs', icon: Users, usage: limits.users },
                { label: 'Collecteurs', icon: UserCheck, usage: limits.collectors },
              ].map(({ label, icon: Icon, usage }) => {
                const full = isFull(usage);
                const percent =
                  usage.limit === null ? 0 : usage.limit === 0 ? 100 : Math.min(100, Math.round((usage.current / usage.limit) * 100));
                return (
                  <div
                    key={label}
                    className={cn(
                      'rounded-xl border p-3',
                      full ? 'border-amber-300 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-900/60' : 'border-slate-200 dark:border-slate-800'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
                        <Icon className="w-4 h-4 text-slate-400" /> {label}
                      </span>
                      <span className="text-xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                        {usage.current}
                        <span className="text-sm font-semibold text-slate-400"> / {usage.limit === null ? '∞' : usage.limit}</span>
                      </span>
                    </div>
                    {usage.limit !== null && (
                      <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div className={cn('h-full rounded-full', full ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${percent}%` }} />
                      </div>
                    )}
                    <p className={cn('mt-1.5 text-xs', full ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-slate-500')}>
                      {usage.limit === null
                        ? 'Illimité'
                        : usage.limit === 0
                          ? 'Non inclus dans votre forfait'
                          : full
                            ? 'Limite atteinte'
                            : `${usage.limit - usage.current} place${usage.limit - usage.current > 1 ? 's' : ''} disponible${usage.limit - usage.current > 1 ? 's' : ''}`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          Chargement des utilisateurs...
        </div>
      ) : users.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-blue-900/10 text-blue-900 dark:text-amber-400 flex items-center justify-center mx-auto">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucun utilisateur trouvé</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Créez des profils pour attribuer des points de vente aux collecteurs de votre équipe.
          </p>
          <AddButton what="un utilisateur" onClick={openAdd} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map((u: Profile) => (
            <Card key={u.id} className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-900 text-brand-400 font-bold flex items-center justify-center text-sm border border-brand-500/30">
                      {u.nom ? u.nom.slice(0, 2).toUpperCase() : 'US'}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">{u.nom}</h3>
                      <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                        <Mail className="w-3 h-3" />
                        <span>{u.email}</span>
                      </div>
                      {u.telephone && (
                        <p className="text-xs text-slate-500 mt-0.5">{u.telephone}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {u.is_active === false && (
                      <Badge variant="neutral" className="text-xs">Inactif</Badge>
                    )}
                    <Badge variant={u.role === 'administrateur' ? 'warning' : 'info'}>
                      {u.role}
                    </Badge>
                  </div>
                </div>
                {/* Accès : jamais utilisés, ou dernière connexion */}
                {status[u.id] && (
                  <p
                    className={cn(
                      'flex items-center gap-1.5 text-xs',
                      status[u.id].pending_password ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-slate-500'
                    )}
                  >
                    {status[u.id].pending_password ? <Clock className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                    {status[u.id].pending_password
                      ? 'Accès pas encore utilisés'
                      : status[u.id].last_sign_in_at
                        ? `Dernière connexion le ${new Date(status[u.id].last_sign_in_at as string).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}`
                        : 'Jamais connecté'}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 font-semibold"
                    onClick={() => setAccessMember(u)}
                    disabled={u.is_active === false}
                  >
                    <KeyRound className="w-4 h-4 mr-1.5" />
                    Accès
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 font-semibold text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-900/60 dark:hover:bg-red-900/30"
                    onClick={() => setDeleteTarget(u)}
                    disabled={u.is_active === false}
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Retirer
                  </Button>
                </div>
              </Card>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Créer un Utilisateur">
        <form onSubmit={handleAddUser} className="space-y-4">
          <Input label="Nom Complet" placeholder="ex: Konan Philippe" value={nom} onChange={(e) => setNom(e.target.value)} required />
          <Input label="Adresse Email" type="email" placeholder="agent@optiwifi.ci" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Téléphone" type="tel" placeholder="ex: +225 07 07 07 07" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
          <Input
            label="Mot de passe temporaire (facultatif)"
            type="text"
            placeholder="Laisser vide : généré automatiquement"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            helperText="Le membre choisira son propre mot de passe à sa première connexion."
            autoComplete="off"
          />
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="w-4 h-4 accent-brand-600" />
            Envoyer les accès par e-mail
          </label>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Rôle</label>
            <CustomSelect
              value={role}
              onChange={(v) => setRole(v as UserRole)}
              options={[
                {
                  value: 'collecteur',
                  label: 'Collecteur / Agent Terrain',
                  sublabel: collectorsFull ? 'Non inclus dans votre forfait actuel' : undefined,
                },
                { value: 'administrateur', label: 'Administrateur Système' },
              ]}
            />
          </div>
          {role === 'collecteur' && collectorsFull && (
            <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900/60 p-3 text-xs text-slate-700 dark:text-slate-300">
              <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <div className="space-y-1.5">
                <p>
                  Votre forfait {limits?.plan?.name} ne permet pas{' '}
                  {limits?.collectors.limit === 0 ? 'de collecteur' : "d'autre collecteur"}.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setLimitKind('collectors');
                  }}
                  className="font-bold text-amber-700 dark:text-amber-400 hover:underline"
                >
                  Voir les forfaits
                </button>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Annuler</Button>
            <Button type="submit" disabled={isSubmitting || (role === 'collecteur' && collectorsFull)}>
              {isSubmitting ? 'Création...' : 'Créer le Compte'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Accès du membre créé : à transmettre maintenant */}
      <Modal isOpen={!!created} onClose={() => setCreated(null)} title={created ? `Accès de ${created.member.nom}` : ''}>
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
        member={accessMember}
        onClose={() => {
          setAccessMember(null);
          loadStatus();
        }}
      />

      <PlanLimitDialog open={limitKind !== null} kind={limitKind ?? 'users'} limits={limits} onClose={() => setLimitKind(null)} />

      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="Supprimer l'utilisateur">
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Êtes-vous sûr de vouloir supprimer <strong className="font-bold text-slate-900 dark:text-white">{deleteTarget?.nom}</strong> de l’équipe ?
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          Toutes les collectes et allocations historiques conserveront les noms d’utilisateur d’origine, mais cet utilisateur ne pourra plus se connecter ni être affecté à de nouvelles tâches.
        </p>
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)}>Annuler</Button>
          <Button
            onClick={() => handleDeleteUser(deleteTarget!)}
            variant="danger"
            disabled={isSubmitting}
          >
            Supprimer
          </Button>
        </div>
      </Modal>
    </div>
  );
}
