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
} from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';
import { formatDateFR } from '@/lib/utils/format';
import { Profile } from '@/types/database';
import { Organization } from '@/types/platform';

interface PlatformUserProfile extends Profile {
  organization?: Organization | null;
  is_banned?: boolean;
}

export default function PlatformUsersPage() {
  const [users, setUsers] = useState<PlatformUserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, [search]);

  async function loadUsers() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search });
      const res = await fetch(`/api/platform/users?${params}`);
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
    if (!window.confirm(`Voulez-vous vraiment ${label} cet utilisateur ?`)) return;

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
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId
              ? { ...u, is_banned: action === 'deactivate' }
              : u
          )
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Utilisateurs Clients</h1>
          <p className="text-xs text-slate-500">Tous les utilisateurs de la plateforme, par organisation.</p>
        </div>
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
          <div className="overflow-x-auto">
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
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border border-amber-500/30 ${
                          u.is_banned
                            ? 'bg-red-100 text-red-600'
                            : 'bg-[#0b1a3a] text-amber-400'
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
                      {u.organization ? (
                        <Link href={`/platform/clients/${u.organization.id}`} className="hover:text-amber-500">
                          {u.organization.name}
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
                      <Badge variant={u.is_banned ? 'danger' : 'success'} className="text-xs">
                        {u.is_banned ? 'Désactivé' : 'Actif'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatDateFR(u.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        {u.is_banned ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-1 h-7 text-emerald-600 hover:text-emerald-700"
                            onClick={() => handleAction(u.id, 'activate', 'réactiver')}
                            disabled={actionLoading === u.id}
                            title="Réactiver"
                          >
                            {actionLoading === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-1 h-7 text-red-600 hover:text-red-700"
                            onClick={() => handleAction(u.id, 'deactivate', 'désactiver')}
                            disabled={actionLoading === u.id}
                            title="Désactiver"
                          >
                            {actionLoading === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                          </Button>
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
                        {u.organization && (
                          <Link href={`/platform/clients/${u.organization.id}`}>
                            <Button variant="ghost" size="sm" className="p-1 h-7 text-blue-600 hover:text-blue-700" title="Voir l'organisation">
                              <Building2 className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
