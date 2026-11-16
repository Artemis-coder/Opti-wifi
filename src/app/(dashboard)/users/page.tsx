'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Users, Mail, Loader2, Trash2, Info, KeyRound, UserCheck, Clock, CheckCircle2, ArrowRight, Store, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Label, Meter } from '@heroui/react';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Button } from '@/components/ui/Button';
import { WriteButton } from '@/components/ui/WriteButton';
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
import { isInternalPosAccountEmail } from '@/lib/pos-account-email';
import { useGuideOpenForm } from '@/lib/onboarding';

export default function UsersPage() {
  // useSearchParams impose une frontière Suspense pour une page prérendue
  return (
    <Suspense fallback={null}>
      <UsersContent />
    </Suspense>
  );
}

function UsersContent() {
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
  // Accès point de vente : non inclus (limite 0) ou limite atteinte ; hors nombre d'utilisateurs du forfait
  const posAccountsFull = isFull(limits?.pos_accounts);

  const loadLimits = () =>
    fetch('/api/account/plan-limits')
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => res?.data && setLimits(res.data as PlanLimits))
      .catch(() => {});

  useEffect(() => {
    loadLimits();
    loadStatus();
  }, []);


  const supabase = createClient();

  // Filtre : équipe (administrateurs, collecteurs) ou accès points de vente (?filtre=points-de-vente)
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter: 'equipe' | 'points-de-vente' = searchParams.get('filtre') === 'points-de-vente' ? 'points-de-vente' : 'equipe';
  const selectFilter = (value: 'equipe' | 'points-de-vente') =>
    router.replace(value === 'points-de-vente' ? `${pathname}?filtre=points-de-vente` : pathname, { scroll: false });
  // Points de vente de l'organisation (nom, téléphone) : nom de chaque accès, choix à la création
  const [posList, setPosList] = useState<{ id: string; nom: string; telephone?: string | null }[]>([]);
  const posNames: Record<string, string> = Object.fromEntries(posList.map((p) => [p.id, p.nom]));
  // Point de vente choisi pour un nouvel accès point de vente
  const [selectedPosId, setSelectedPosId] = useState('');
  const posAccounts = users.filter((u) => u.role === 'point_de_vente');
  // Points de vente qui n'ont pas encore d'accès (un seul accès par point de vente)
  const posWithoutAccess = posList.filter((p) => !posAccounts.some((a) => a.pos_id === p.id));
  // Type de compte choisi ; pour un point de vente, nom et téléphone repris de sa fiche
  const chooseRole = (value: UserRole) => {
    setRole(value);
    if (value !== 'point_de_vente') return;
    const first = posWithoutAccess.find((p) => p.id === selectedPosId) ?? posWithoutAccess[0];
    if (first) choosePos(first.id);
  };
  const choosePos = (id: string) => {
    setSelectedPosId(id);
    const pos = posList.find((p) => p.id === id);
    if (!pos) return;
    setNom(pos.nom);
    setTelephone(pos.telephone || '');
  };
  const teamMembers = users.filter((u) => u.role !== 'point_de_vente');
  const shownUsers = filter === 'points-de-vente' ? posAccounts : teamMembers;

  // « Ajouter » : note d'information si le forfait ne permet pas un membre de plus
  const openAdd = () => {
    // Onglet « Accès points de vente » : le formulaire s'ouvre directement sur ce type de compte
    if (filter === 'points-de-vente') {
      chooseRole('point_de_vente');
      setIsModalOpen(true);
      return;
    }
    if (usersFull) {
      // Plus de place pour un membre, mais un accès point de vente reste possible (hors nombre d'utilisateurs)
      if (!posAccountsFull && posWithoutAccess.length > 0) {
        chooseRole('point_de_vente');
        setIsModalOpen(true);
        return;
      }
      setLimitKind('users');
      return;
    }
    if (collectorsFull) setRole('administrateur');
    setIsModalOpen(true);
  };
  // Guide de démarrage (« Ajouter un collecteur ») : ouvre le formulaire
  useGuideOpenForm(openAdd);

  useEffect(() => {
    async function loadUsers() {
      setLoading(true);
      const [{ data }, { data: posData }] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('points_of_sale').select('id, nom, telephone').order('nom'),
      ]);
      setPosList((posData || []) as { id: string; nom: string; telephone?: string | null }[]);
      // Les comptes supprimés disparaissent de l'équipe (leurs collectes restent dans l'historique)
      setUsers((data || []).filter(isActiveProfile));
      setLoading(false);
    }
    loadUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const isPos = role === 'point_de_vente';
    if (isPos) {
      if (!selectedPosId) {
        toast.error('Choisissez le point de vente.');
        return;
      }
      if (!nom || telephone.replace(/\D/g, '').length < 8) {
        toast.error('Le nom et le numéro de téléphone (identifiant de connexion) sont obligatoires.');
        return;
      }
    } else if (!nom || !email) {
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
      body: JSON.stringify({
        nom,
        email,
        role,
        telephone,
        mot_de_passe: motDePasse,
        send_email: sendEmail && email.trim() !== '',
        ...(isPos ? { pos_id: selectedPosId } : {}),
      }),
    });

    const result = await res.json();
    setIsSubmitting(false);

    // Limite atteinte entre-temps (contrôle serveur) : on montre les forfaits
    if (res.status === 403 && result.planLimit === 'pos_accounts') {
      toast.error(result.error);
      loadLimits();
      return;
    }
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
      if (isPos) {
        setSelectedPosId('');
        setRole('collecteur');
        selectFilter('points-de-vente');
        // Le numéro de connexion devient aussi celui de la fiche du point de vente
        setPosList((prev) => prev.map((p) => (p.id === result.profile?.pos_id ? { ...p, telephone: result.profile?.telephone } : p)));
      }
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
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Gestion des Utilisateurs</h1>
          <p className="text-xs text-muted">Profils et rôles d&apos;accès à la plateforme.</p>
        </div>
        <AddButton what="un utilisateur" onClick={openAdd} />
      </div>

      {/* Forfait : places utilisées et disponibles (HeroUI Meter) */}
      {limits?.plan && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted">Votre forfait</p>
              <Badge variant="info">{limits.plan.name}</Badge>
            </div>
            <Link href="/subscription" className="link inline-flex items-center gap-1 text-sm">
              Changer de forfait <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className={cn('grid grid-cols-1 gap-3 sm:gap-4', limits.pos_accounts ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
            {[
              { label: 'Utilisateurs', icon: Users, usage: limits.users },
              { label: 'Collecteurs', icon: UserCheck, usage: limits.collectors },
              ...(limits.pos_accounts ? [{ label: 'Accès points de vente', icon: Store, usage: limits.pos_accounts }] : []),
            ].map(({ label, icon: Icon, usage }) => {
              const full = isFull(usage);
              const hint =
                usage.limit === null
                  ? 'Illimité'
                  : usage.limit === 0
                    ? 'Non inclus dans votre forfait'
                    : full
                      ? 'Limite atteinte'
                      : `${usage.limit - usage.current} place${usage.limit - usage.current > 1 ? 's' : ''} disponible${usage.limit - usage.current > 1 ? 's' : ''}`;
              return (
                <div key={label} className="flex flex-col gap-2 rounded-xl border border-border p-3">
                  {usage.limit === null || usage.limit === 0 ? (
                    <>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-1.5 font-medium text-foreground">
                          <Icon className="size-4 text-muted" /> {label}
                        </span>
                        <span className="tabular-nums text-muted">
                          {usage.current} / {usage.limit === null ? '∞' : 0}
                        </span>
                      </div>
                      {/* Jauge vide : même hauteur que les quotas limités */}
                      <div aria-hidden className="h-2 rounded-sm bg-default" />
                    </>
                  ) : (
                    <Meter value={usage.current} maxValue={usage.limit} color={full ? 'warning' : 'success'} valueLabel={`${usage.current} / ${usage.limit}`}>
                      <Label className="flex items-center gap-1.5">
                        <Icon className="size-4 text-muted" /> {label}
                      </Label>
                      <Meter.Output className="tabular-nums" />
                      <Meter.Track>
                        <Meter.Fill />
                      </Meter.Track>
                    </Meter>
                  )}
                  <p className={cn('text-xs', full ? 'font-medium text-warning-soft-foreground' : 'text-muted')}>{hint}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Équipe / accès points de vente : chacun géré séparément */}
      <div role="tablist" aria-label="Type de comptes" className="grid grid-cols-2 gap-2 sm:flex">
        {(
          [
            { value: 'equipe', label: 'Équipe', icon: Users, count: teamMembers.length },
            { value: 'points-de-vente', label: 'Accès points de vente', icon: Store, count: posAccounts.length },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const active = filter === t.value;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectFilter(t.value)}
              className={cn(
                'inline-flex min-w-0 items-center justify-center gap-2 h-10 px-3 sm:px-4 rounded-xl text-sm font-semibold border transition',
                active
                  ? 'bg-foreground text-background border-border'
                  : 'bg-surface text-muted border-border hover:bg-surface-secondary hover:text-foreground',
              )}
            >
              <Icon className="size-4 shrink-0" /> <span className="truncate">{t.label}</span>
              <span className={cn('text-xs tabular-nums', active ? 'opacity-80' : 'text-muted')}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {filter === 'points-de-vente' && (
        <p className="flex items-start gap-2 text-xs text-muted">
          <Eye className="w-4 h-4 shrink-0" />
          <span>
            Accès en consultation seule : chaque point de vente voit ses allocations et ses collectes, et se connecte avec
            son numéro de téléphone. Créez un accès avec « Ajouter », ou depuis la fiche du point de vente dans{' '}
            <Link href="/pos" className="font-semibold text-accent hover:underline">
              Points de vente
            </Link>{' '}
            (onglet « Accès point de vente »).
          </span>
        </p>
      )}

      {loading ? (
        <div className="py-10 flex justify-center items-center gap-2 text-muted text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-accent" />
          Chargement des utilisateurs...
        </div>
      ) : filter === 'points-de-vente' && shownUsers.length === 0 ? (
        <Card className="text-center space-y-2 py-8">
          <Store className="w-8 h-8 mx-auto text-muted" />
          <h3 className="text-base font-semibold text-foreground">Aucun accès point de vente</h3>
          <p className="text-xs text-muted max-w-sm mx-auto">
            Créez-en un avec « Ajouter » (type « Point de vente »), ou depuis la fiche du point de vente.
          </p>
          <AddButton what="un accès point de vente" onClick={openAdd} />
        </Card>
      ) : shownUsers.length === 0 ? (
        <Card className="text-center space-y-3 py-8">
          <div className="w-14 h-14 rounded-full bg-accent-soft text-accent flex items-center justify-center mx-auto">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Aucun utilisateur trouvé</h3>
          <p className="text-xs text-muted max-w-sm mx-auto">
            Créez des profils pour attribuer des points de vente aux collecteurs de votre équipe.
          </p>
          <AddButton what="un utilisateur" onClick={openAdd} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {shownUsers.map((u: Profile) => (
            <Card key={u.id} className="space-y-4">
                <div className="flex flex-wrap-reverse items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-[12rem] flex-1">
                    <UserAvatar name={u.nom} email={u.email} size="md" danger={u.is_active === false} className="shrink-0" />
                    <div>
                      <h3 className="font-semibold text-sm text-foreground">{u.nom}</h3>
                      <div className="flex items-center gap-1 text-xs text-muted mt-0.5">
                        <Mail className="w-3 h-3" />
                        <span>{isInternalPosAccountEmail(u.email) ? 'Connexion par téléphone' : u.email}</span>
                      </div>
                      {u.telephone && (
                        <p className="text-xs text-muted mt-0.5">{u.telephone}</p>
                      )}
                      {u.role === 'point_de_vente' && u.pos_id && (
                        <Link
                          href={`/pos/${u.pos_id}?tab=acces`}
                          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                        >
                          <Store className="w-3 h-3" /> {posNames[u.pos_id] || 'Point de vente'}
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {u.is_active === false && (
                      <Badge variant="neutral" className="text-xs">Inactif</Badge>
                    )}
                    <Badge
                      variant={u.role === 'administrateur' ? 'warning' : u.role === 'point_de_vente' ? 'success' : 'info'}
                      className="whitespace-nowrap"
                    >
                      {u.role === 'point_de_vente' ? 'point de vente' : u.role}
                    </Badge>
                  </div>
                </div>
                {/* Accès : jamais utilisés, ou dernière connexion */}
                {status[u.id] && (
                  <p
                    className={cn(
                      'flex items-center gap-1.5 text-xs',
                      status[u.id].pending_password ? 'font-semibold text-warning-soft-foreground' : 'text-muted'
                    )}
                  >
                    {status[u.id].pending_password ? <Clock className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5 text-success-soft-foreground" />}
                    {status[u.id].pending_password
                      ? 'Accès pas encore utilisés'
                      : status[u.id].last_sign_in_at
                        ? `Dernière connexion le ${new Date(status[u.id].last_sign_in_at as string).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}`
                        : 'Jamais connecté'}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <WriteButton
                    variant="outline"
                    size="sm"
                    className="h-10 font-semibold"
                    onClick={() => setAccessMember(u)}
                    disabled={u.is_active === false}
                  >
                    <KeyRound className="w-4 h-4 mr-1.5" />
                    Accès
                  </WriteButton>
                  <WriteButton
                    variant="outline"
                    size="sm"
                    className="h-10 font-semibold text-danger border-danger/30 hover:bg-danger-soft"
                    onClick={() => setDeleteTarget(u)}
                    disabled={u.is_active === false}
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Retirer
                  </WriteButton>
                </div>
              </Card>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Créer un Utilisateur">
        <form onSubmit={handleAddUser} className="space-y-4">
          {/* Type de compte d'abord : les champs en dépendent */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground">Type d&apos;utilisateur</label>
            <CustomSelect
              value={role}
              onChange={(v) => chooseRole(v as UserRole)}
              options={[
                {
                  value: 'collecteur',
                  label: 'Collecteur / Agent Terrain',
                  sublabel: collectorsFull ? 'Non inclus dans votre forfait actuel' : undefined,
                },
                { value: 'administrateur', label: 'Administrateur Système' },
                {
                  value: 'point_de_vente',
                  label: 'Point de vente (consultation seule)',
                  sublabel: posAccountsFull
                    ? limits?.pos_accounts?.limit === 0
                      ? 'Non inclus dans votre forfait actuel'
                      : 'Limite de votre forfait atteinte'
                    : 'Voit ses allocations et ses collectes, se connecte avec son téléphone',
                },
              ]}
            />
          </div>

          {role === 'point_de_vente' ? (
            posAccountsFull ? (
              <div className="flex gap-2.5 rounded-xl bg-warning-soft p-3 text-xs text-foreground">
                <Info className="w-4 h-4 shrink-0 text-warning-soft-foreground mt-0.5" />
                <div className="space-y-1.5">
                  <p>
                    {limits?.pos_accounts?.limit === 0
                      ? `L'accès point de vente n'est pas inclus dans votre forfait ${limits?.plan?.name ?? ''}.`
                      : `Votre forfait ${limits?.plan?.name ?? ''} ne permet pas d'autre accès point de vente.`}
                  </p>
                  <Link href="/subscription" className="font-semibold text-warning-soft-foreground hover:underline">
                    Voir les forfaits
                  </Link>
                </div>
              </div>
            ) : posWithoutAccess.length === 0 ? (
              <div className="flex gap-2.5 rounded-xl bg-surface-secondary p-3 text-xs text-muted">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  {posList.length === 0
                    ? "Vous n'avez encore aucun point de vente. Créez-en un dans Points de vente."
                    : 'Tous vos points de vente ont déjà un accès.'}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">Point de vente</label>
                  <CustomSelect
                    value={selectedPosId}
                    onChange={(v) => choosePos(v)}
                    options={posWithoutAccess.map((p) => ({ value: p.id, label: p.nom, sublabel: p.telephone || undefined }))}
                  />
                </div>
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
                />
              </>
            )
          ) : (
            <>
          <Input label="Nom Complet" placeholder="ex: Konan Philippe" value={nom} onChange={(e) => setNom(e.target.value)} required />
          <Input label="Adresse Email" type="email" placeholder="agent@optiwifi.ci" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Téléphone" type="tel" placeholder="ex: +225 07 07 07 07" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
            </>
          )}
          {!(role === 'point_de_vente' && (posAccountsFull || posWithoutAccess.length === 0)) && (
          <>
          <Input
            label="Mot de passe temporaire (facultatif)"
            type="text"
            placeholder="Laisser vide : généré automatiquement"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            helperText="Le membre choisira son propre mot de passe à sa première connexion."
            autoComplete="off"
          />
          {(role !== 'point_de_vente' || email.trim() !== '') && (
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="w-4 h-4 accent-brand-600" />
              Envoyer les accès par e-mail
            </label>
          )}
          </>
          )}
          {role === 'collecteur' && collectorsFull && (
            <div className="flex gap-2.5 rounded-xl bg-warning-soft p-3 text-xs text-foreground">
              <Info className="w-4 h-4 shrink-0 text-warning-soft-foreground mt-0.5" />
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
                  className="font-semibold text-warning-soft-foreground hover:underline"
                >
                  Voir les forfaits
                </button>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Annuler</Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                (role === 'collecteur' && collectorsFull) ||
                (role === 'point_de_vente' && (posAccountsFull || posWithoutAccess.length === 0))
              }
            >
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
        <p className="text-sm text-muted mb-4">
          Êtes-vous sûr de vouloir supprimer <strong className="font-semibold text-foreground">{deleteTarget?.nom}</strong> de l’équipe ?
        </p>
        <p className="text-xs text-muted mb-6">
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
