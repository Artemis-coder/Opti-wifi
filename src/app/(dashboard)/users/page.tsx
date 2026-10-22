'use client';

import React, { useState, useEffect } from 'react';
import { Users, Plus, Mail, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Profile, UserRole } from '@/types/database';
import { createClient } from '@/lib/supabase/client';

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

  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function loadUsers() {
      setLoading(true);
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      setUsers(data || []);
      setLoading(false);
    }
    loadUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom || !email || !motDePasse) {
      toast.error('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (motDePasse.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setIsSubmitting(true);

    const res = await fetch('/api/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, email, role, telephone, mot_de_passe: motDePasse }),
    });

    const result = await res.json();
    setIsSubmitting(false);

    if (res.ok && result.success) {
      setUsers([result.profile, ...users]);
      toast.success('Utilisateur créé avec succès.');
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
      setUsers(users.map(u => u.id === user.id ? { ...u, is_active: false, deleted_at: new Date().toISOString() } : u));
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
        <Button onClick={() => setIsModalOpen(true)} className="gap-2 font-semibold">
          <Plus className="w-4 h-4" /> Créer un Utilisateur
        </Button>
      </div>

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
          <Button onClick={() => setIsModalOpen(true)} variant="secondary" className="font-bold gap-2">
            <Plus className="w-4 h-4" /> Ajouter un utilisateur
          </Button>
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center gap-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                  onClick={() => setDeleteTarget(u)}
                  disabled={u.is_active === false}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Supprimer de l'équipe
                </Button>
              </Card>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Créer un Utilisateur">
        <form onSubmit={handleAddUser} className="space-y-4">
          <Input label="Nom Complet" placeholder="ex: Konan Philippe" value={nom} onChange={(e) => setNom(e.target.value)} required />
          <Input label="Adresse Email" type="email" placeholder="agent@optiwifi.ci" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Téléphone" type="tel" placeholder="ex: +225 07 07 07 07" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
          <Input label="Mot de Passe" type="password" placeholder="•••••••• (6+ caractères)" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} required />
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Rôle</label>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm">
              <option value="collecteur">Collecteur / Agent Terrain</option>
              <option value="administrateur">Administrateur Système</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Annuler</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Création...' : 'Créer le Compte'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="Supprimer l'utilisateur">
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Êtes-vous sûr de vouloir supprimer <strong className="font-bold text-slate-900 dark:text-white">{deleteTarget?.nom}</strong> de l'équipe ?
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          Toutes les collectes et allocations historiques conserveront les noms d'utilisateur d'origine, mais cet utilisateur ne pourra plus se connecter ni être affecté à de nouvelles tâches.
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
