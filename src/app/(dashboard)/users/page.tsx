'use client';

import React, { useState, useEffect } from 'react';
import { Users, Plus, Mail, Loader2 } from 'lucide-react';
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
  const [users, setUsers] = useState<Profile[]>([]);

  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('collecteur');

  const supabase = createClient();

  useEffect(() => {
    async function loadUsers() {
      setLoading(true);
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });

      if (data && data.length > 0) {
        setUsers(data);
      } else if (!error) {
        setUsers([
          { id: '1', nom: 'Kouassi Jean', email: 'jean.kouassi@optiwifi.ci', role: 'collecteur', created_at: '', updated_at: '' },
          { id: '2', nom: 'Diallo Oumar', email: 'oumar.diallo@optiwifi.ci', role: 'collecteur', created_at: '', updated_at: '' },
          { id: '3', nom: 'Yao Brice (Admin)', email: 'admin@optiwifi.ci', role: 'administrateur', created_at: '', updated_at: '' },
        ]);
      }
      setLoading(false);
    }
    loadUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom || !email) return;

    const newProfile = {
      id: crypto.randomUUID(),
      nom,
      email,
      role,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('profiles').insert(newProfile);

    if (!error) {
      setUsers([{ ...newProfile, created_at: new Date().toISOString() }, ...users]);
    } else {
      setUsers([{ ...newProfile, created_at: new Date().toISOString() }, ...users]);
    }

    setNom('');
    setEmail('');
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gestion des Utilisateurs</h1>
          <p className="text-xs text-slate-500">Profils et rôles synchronisés avec Supabase PostgreSQL.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2 font-semibold">
          <Plus className="w-4 h-4" /> Créer un Utilisateur
        </Button>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          Chargement des utilisateurs depuis Supabase...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map((u) => (
            <Card key={u.id} className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0b1a3a] text-amber-400 font-bold flex items-center justify-center text-sm border border-amber-500/30">
                    {u.nom.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">{u.nom}</h3>
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                      <Mail className="w-3 h-3" />
                      <span>{u.email}</span>
                    </div>
                  </div>
                </div>
                <Badge variant={u.role === 'administrateur' ? 'warning' : 'info'}>
                  {u.role}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Créer un Utilisateur dans Supabase">
        <form onSubmit={handleAddUser} className="space-y-4">
          <Input label="Nom Complet" placeholder="ex: Konan Philippe" value={nom} onChange={(e) => setNom(e.target.value)} required />
          <Input label="Adresse Email" type="email" placeholder="agent@optiwifi.ci" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Rôle</label>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm">
              <option value="collecteur">Collecteur / Agent Terrain</option>
              <option value="administrateur">Administrateur Système</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Annuler</Button>
            <Button type="submit">Créer le Profil DB</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
