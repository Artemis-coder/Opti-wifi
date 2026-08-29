'use client';

import React, { useState } from 'react';
import { Users, Plus, Shield, Mail, Phone } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';

export default function UsersPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [users, setUsers] = useState([
    { id: '1', nom: 'Kouassi Jean', email: 'jean.kouassi@optiwifi.ci', role: 'collecteur', phone: '+225 07 08 09 10' },
    { id: '2', nom: 'Diallo Oumar', email: 'oumar.diallo@optiwifi.ci', role: 'collecteur', phone: '+225 05 06 07 08' },
    { id: '3', nom: 'Yao Brice (Admin)', email: 'admin@optiwifi.ci', role: 'administrateur', phone: '+225 01 02 03 04' },
  ]);

  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('collecteur');

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom || !email) return;
    setUsers([...users, { id: Date.now().toString(), nom, email, role, phone: '+225 00 00 00 00' }]);
    setNom('');
    setEmail('');
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gestion des Utilisateurs</h1>
          <p className="text-xs text-slate-500">Gérez les accès des administrateurs et des collecteurs terrain.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Créer un Utilisateur
        </Button>
      </div>

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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Créer un Nouvel Utilisateur">
        <form onSubmit={handleAddUser} className="space-y-4">
          <Input label="Nom Complet" placeholder="ex: Konan Philippe" value={nom} onChange={(e) => setNom(e.target.value)} required />
          <Input label="Adresse Email" type="email" placeholder="agent@optiwifi.ci" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Rôle</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm">
              <option value="collecteur">Collecteur / Agent Terrain</option>
              <option value="administrateur">Administrateur Système</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Annuler</Button>
            <Button type="submit">Créer le Compte</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
