'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Loader2,
  UserCheck,
  Ban,
  KeyRound,
  Mail,
  Clock,
  Shield,
  Building2,
  Plus,
  X,
  UserPlus,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';
import { formatDateFR } from '@/lib/utils/format';
import { PlatformUser } from '@/types/platform';
import { usePlatformAuthStore } from '@/lib/stores/platformAuthStore';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { confirmAction } from '@/components/ui/ConfirmDialog';

interface PlatformUserProfile {
  id: string;
  nom: string | null;
  email: string | null;
  role: 'administrateur' | 'collecteur';
  telephone: string | null;
  devise: string | null;
  organization_id: string | null;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  organization_name: string | null;
  is_banned?: boolean;
}

export default function PlatformUsersPage() {
  const [users, setUsers] = useState<PlatformUserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [changeRoleUser, setChangeRoleUser] = useState<PlatformUserProfile | null>(null);
  const [newRoleValue, setNewRoleValue] = useState<'administrateur' | 'collecteur'>('administrateur');
  const [newOrgIdValue, setNewOrgIdValue] = useState<string>('');
  const [savingRole, setSavingRole] = useState(false);
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);

  const { platformUser: currentPlatformUser, setPlatformUser } = usePlatformAuthStore();

interface CreateFormState {
    email: string;
    nom: string;
    password: string;
    telephone: string;
    devise: string;
    organization_id: string;
    role: 'administrateur' | 'collecteur';
  }
  const [createFormData, setCreateFormData] = useState<CreateFormState>({
    email: '', nom: '', password: '', telephone: '', devise: 'XOF', organization_id: '', role: 'administrateur',
  });

  useEffect(() => {
    loadUsers();
  }, [search]);

  useEffect(() => {
    if (showCreateModal || changeRoleUser) loadOrganizations();
  }, [showCreateModal, changeRoleUser]);

  async function loadOrganizations() {
    setOrgsLoading(true);
    try {
      const res = await fetch('/api/platform/clients?limit=200', {
        credentials: 'include',
      });
      const result = await res.json();
      if (res.ok) {
        setOrganizations(result.data?.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })) || []);
      }
    } catch {
      toast.error('Erreur de chargement des organisations');
    }
    setOrgsLoading(false);
  }

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await fetch(`/api/platform/users?${new URLSearchParams({ search })}`, {
        credentials: 'include',
      });
      const result = await res.json();
      if (res.ok) {
        setUsers(result.data || []);
      }
    } catch {
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }

  const handleAction = async (userId: string, action: string, label: string) => {
    if (action === 'change_role') return;
    const consequence: Record<string, string> = {
      deactivate: "\n\nSon accès est coupé immédiatement. Vous pourrez le réactiver.",
      delete: "\n\nSon accès est coupé immédiatement. Son historique (collectes, allocations) est conservé et il peut être réactivé.",
      reset_password: '\n\nUn mot de passe temporaire sera généré ; il devra en choisir un nouveau à sa prochaine connexion.',
    };
    const danger = ['deactivate', 'delete'].includes(action);
    if (!(await confirmAction(`Voulez-vous vraiment ${label} cet utilisateur ?${consequence[action] || ''}`, { danger }))) return;

    setActionLoading(userId);
    try {
      const res = await fetch('/api/platform/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(result.message);
        if (result.temporary_password) {
          toast.warning(`Mot de passe temporaire : ${result.temporary_password}`, { duration: 15000 });
        }
        setUsers((prev) =>
          prev.map((u: PlatformUserProfile) => {
            if (u.id !== userId) return u;
            if (action === 'deactivate') return { ...u, is_banned: true, is_active: false };
            if (action === 'delete') return { ...u, is_banned: true, is_active: false, deleted_at: new Date().toISOString() };
            if (action === 'activate') return { ...u, is_banned: false, is_active: true, deleted_at: null };
            return u;
          })
        );
      } else {
        toast.error(result.error || 'Erreur');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateAdmin = async () => {
    if (!createFormData.email || !createFormData.nom || !createFormData.organization_id) {
      toast.error('Email, nom et organisation requis.');
      return;
    }
    if (createFormData.password.length > 0 && createFormData.password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/platform/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: createFormData.email,
          nom: createFormData.nom,
          password: createFormData.password || undefined,
          telephone: createFormData.telephone || undefined,
          devise: createFormData.devise,
          organization_id: createFormData.organization_id,
          role: createFormData.role,
        }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(result.message);
        if (result.temporary_password) {
          toast.warning(`Mot de passe temporaire : ${result.temporary_password}`, { duration: 10000 });
        }
        setShowCreateModal(false);
        setCreateFormData({
          email: '', nom: '', password: '', telephone: '', devise: 'XOF', organization_id: '', role: 'administrateur',
        });
        loadUsers();
      } else {
        toast.error(result.error || 'Erreur');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setCreating(false);
    }
  };

  const openChangeRole = (u: PlatformUserProfile) => {
    setChangeRoleUser(u);
    setNewRoleValue(u.role);
    setNewOrgIdValue(u.organization_id || '');
  };

  const handleChangeRoleSave = async () => {
    if (!changeRoleUser || !newRoleValue) return;
    setSavingRole(true);
    try {
      const res = await fetch('/api/platform/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: changeRoleUser.id,
          action: 'change_role',
          role: newRoleValue,
          organization_id: newOrgIdValue || undefined,
        }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(result.message);
        setUsers((prev) =>
          prev.map((u: PlatformUserProfile) =>
            u.id === changeRoleUser.id
              ? {
                  ...u,
                  role: result.data?.role || newRoleValue,
                  organization_id: result.data?.organization_id || u.organization_id,
                }
              : u
          )
        );
        setChangeRoleUser(null);
      } else {
        toast.error(result.error || 'Erreur');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setSavingRole(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Utilisateurs</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Tous les administrateurs de la plateforme.</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="h-9">
          <Plus className="w-4 h-4 mr-2" />
          Créer un administrateur
        </Button>
      </div>

      <Card className="p-4">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par nom ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </Card>

      {loading ? (
        <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          <span>Chargement des utilisateurs...</span>
        </div>
      ) : users.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucun utilisateur trouvé</h3>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ResponsiveTable>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Utilisateur</th>
                  <th className="px-4 py-3">Organisation</th>
                  <th className="px-4 py-3">Rôle</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Création</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {users.map((u: PlatformUserProfile) => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border border-amber-500/30 ${
                          u.is_banned
                            ? 'bg-red-100 text-red-600'
                            : 'bg-brand-900 text-brand-400'
                        }`}>
                          {u.nom?.[0] || u.email?.[0] || 'U'}
                        </div>
                        <div>
                          <p className={`font-semibold ${u.is_banned ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                            {u.nom || u.email}
                          </p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {u.organization_name ? (
                        <Link href={`/platform/clients/${u.organization_id}`} className="hover:text-amber-500">
                          {u.organization_name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.role === 'administrateur' ? 'warning' : 'info'} className="text-xs">
                        {u.role === 'administrateur' ? '👑 Admin' : u.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={u.deleted_at ? 'neutral' : u.is_banned || !u.is_active ? 'danger' : 'success'}
                        className="text-xs"
                      >
                        {u.deleted_at ? 'Supprimé' : u.is_banned || !u.is_active ? 'Suspendu' : 'Actif'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatDateFR(u.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        {currentPlatformUser?.auth_user_id === u.id ? (
                          <span className="text-[11px] text-slate-400 self-center mr-1">Vous</span>
                        ) : u.deleted_at || u.is_banned || !u.is_active ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-1 h-7 text-emerald-600 hover:text-emerald-700"
                            onClick={() => handleAction(u.id, 'activate', 'réactiver')}
                            disabled={actionLoading === u.id}
                            title="Réactiver (rétablir l'accès)"
                          >
                            {actionLoading === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="p-1 h-7 text-red-600 hover:text-red-700"
                              onClick={() => handleAction(u.id, 'deactivate', 'suspendre')}
                              disabled={actionLoading === u.id}
                              title="Suspendre (couper l'accès)"
                            >
                              {actionLoading === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="p-1 h-7 text-red-700 hover:text-red-800"
                              onClick={() => handleAction(u.id, 'delete', 'supprimer')}
                              disabled={actionLoading === u.id}
                              title="Supprimer (couper l'accès, historique conservé)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1 h-7 text-slate-600 hover:text-slate-900"
                          onClick={() => handleAction(u.id, 'reset_password', 'réinitialiser le mot de passe')}
                          disabled={actionLoading === u.id}
                          title="Réinitialiser le mot de passe"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </Button>
                        {u.organization_id && (
                          <Link href={`/platform/clients/${u.organization_id}`}>
                            <Button variant="ghost" size="sm" className="p-1 h-7 text-blue-600 hover:text-blue-700" title="Voir l'organisation">
                              <Building2 className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        )}
                        {currentPlatformUser?.auth_user_id !== u.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1 h-7 text-amber-600 hover:text-amber-700"
                          onClick={() => openChangeRole(u)}
                          disabled={actionLoading === u.id || savingRole}
                          title="Changer le rôle / l'organisation"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                        </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTable>
        </Card>
      )}

      {/* Create Admin Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Créer un administrateur</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Email *</label>
                <input
                  type="email"
                  value={createFormData.email}
                  onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value.toLowerCase() })}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="admin@organisation.com"
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Nom complet *</label>
                <input
                  type="text"
                  value={createFormData.nom}
                  onChange={(e) => setCreateFormData({ ...createFormData, nom: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Jean Dupont"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Mot de passe (laissé vide = auto-généré)</label>
                <input
                  type="password"
                  value={createFormData.password}
                  onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Laisser vide pour générer"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Téléphone</label>
               <input
                 type="tel"
                 value={createFormData.telephone}
                 onChange={(e) => setCreateFormData({ ...createFormData, telephone: e.target.value })}
                 className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                 placeholder="+225 XX XX XX XX"
               />
             </div>
             <div>
               <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Devise</label>
               <CustomSelect
                 value={createFormData.devise}
                 onChange={(v) => setCreateFormData({ ...createFormData, devise: v })}
                 options={[
                   { value: 'XOF', label: 'XOF (Franc CFA)' },
                   { value: 'EUR', label: 'EUR (Euro)' },
                   { value: 'USD', label: 'USD (Dollar US)' },
                 ]}
               />
             </div>
             <div>
               <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Rôle</label>
               <CustomSelect
                 value={createFormData.role}
                 onChange={(v) => setCreateFormData({ ...createFormData, role: v as 'administrateur' | 'collecteur' })}
                 options={[
                   { value: 'administrateur', label: 'Administrateur' },
                   { value: 'collecteur', label: 'Collecteur' },
                 ]}
               />
             </div>
             <div>
               <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Organisation *</label>
               {showCreateModal && orgsLoading ? (
                 <div className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-500 animate-pulse">Chargement...</div>
               ) : (
                 <CustomSelect
                   value={createFormData.organization_id}
                   onChange={(v) => setCreateFormData({ ...createFormData, organization_id: v })}
                   options={[
                     { value: '', label: 'Sélectionner une organisation' },
                     ...organizations.map((org) => ({ value: org.id, label: org.name })),
                   ]}
                 />
               )}
             </div>
           </div>
           <div className="flex justify-end gap-2 pt-2">
             <Button variant="secondary" onClick={() => setShowCreateModal(false)} disabled={creating}>
               Annuler
             </Button>
             <Button onClick={handleCreateAdmin} disabled={creating}>
               {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4 mr-1" />}
               {creating ? 'Création...' : 'Créer'}
             </Button>
           </div>
         </Card>
       </div>
     )}

     {/* Change Role Modal */}
     {changeRoleUser && (
       <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
         <Card className="w-full max-w-md p-6 space-y-4">
           <div className="flex items-center justify-between">
             <h2 className="text-lg font-semibold">Modifier le rôle / l&apos;organisation</h2>
             <Button variant="ghost" size="sm" onClick={() => setChangeRoleUser(null)}>
               <X className="w-4 h-4" />
             </Button>
           </div>
           <p className="text-sm text-slate-600 dark:text-slate-400">
             Utilisateur : <span className="font-medium">{changeRoleUser.nom || changeRoleUser.email}</span>
           </p>
           <div className="space-y-3">
             <div>
               <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Nouveau rôle</label>
               <CustomSelect
                 value={newRoleValue}
                 onChange={(v) => setNewRoleValue(v as 'administrateur' | 'collecteur')}
                 options={[
                   { value: 'administrateur', label: 'Administrateur' },
                   { value: 'collecteur', label: 'Collecteur' },
                 ]}
               />
             </div>
             <div>
               <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Nouvelle organisation</label>
               {orgsLoading ? (
                 <div className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-500 animate-pulse">Chargement...</div>
               ) : (
                 <CustomSelect
                   value={newOrgIdValue}
                   onChange={(v) => setNewOrgIdValue(v)}
                   options={[
                     { value: '', label: '— Conserver l\'actuelle —' },
                     ...organizations.map((org) => ({ value: org.id, label: org.name })),
                   ]}
                 />
               )}
             </div>
           </div>
           <div className="flex justify-end gap-2 pt-2">
             <Button variant="secondary" onClick={() => setChangeRoleUser(null)} disabled={savingRole}>
               Annuler
             </Button>
             <Button onClick={handleChangeRoleSave} disabled={savingRole}>
               {savingRole ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer'}
             </Button>
           </div>
</Card>
        </div>
      )}

    </div>
  );
}