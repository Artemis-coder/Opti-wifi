'use client';

import React, { useState } from 'react';
import { Store, Plus, Search, MapPin, UserCheck } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PointOfSale } from '@/types/database';

export default function PosPage() {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [posList, setPosList] = useState<PointOfSale[]>([
    { id: '1', nom: 'POS Cocody St Jean', adresse: 'Rue des Jardins', ville: 'Abidjan', statut: 'actif', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '2', nom: 'POS Yopougon Maroc', adresse: 'Carrefour Bel Air', ville: 'Abidjan', statut: 'actif', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '3', nom: 'POS Marcory Zone 4', adresse: 'Bd de Marseille', ville: 'Abidjan', statut: 'inactif', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '4', nom: 'POS Plateau Centre', adresse: 'Avenue Chardy', ville: 'Abidjan', statut: 'actif', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ]);

  const [nom, setNom] = useState('');
  const [adresse, setAdresse] = useState('');
  const [ville, setVille] = useState('Abidjan');

  const filteredPos = posList.filter((p) =>
    p.nom.toLowerCase().includes(search.toLowerCase()) ||
    p.ville.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom) return;
    const newPos: PointOfSale = {
      id: Date.now().toString(),
      nom,
      adresse,
      ville,
      statut: 'actif',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setPosList([newPos, ...posList]);
    setNom('');
    setAdresse('');
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Points de Vente (POS)</h1>
          <p className="text-xs text-slate-500">Gérez le réseau de distribution et les affectations de collecteurs.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Ajouter un POS
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par nom ou ville..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </Card>

      {/* Grid POS Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPos.map((pos) => (
          <Card key={pos.id} className="space-y-4 hover:border-amber-500/50 transition">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-900/10 text-blue-900 dark:text-amber-400 border border-blue-900/20">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">{pos.nom}</h3>
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{pos.adresse || pos.ville}</span>
                  </div>
                </div>
              </div>
              <Badge variant={pos.statut === 'actif' ? 'success' : 'neutral'}>
                {pos.statut}
              </Badge>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Collecteur : <strong className="text-slate-800 dark:text-slate-200">Kouassi J.</strong></span>
              </div>
              <span className="text-[11px] text-slate-400">ID #{pos.id.slice(0, 4)}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Add POS Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Créer un Point de Vente">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Nom du POS" placeholder="ex: POS Cocody St Jean" value={nom} onChange={(e) => setNom(e.target.value)} required />
          <Input label="Adresse / Emplacement" placeholder="ex: Rue des Jardins" value={adresse} onChange={(e) => setAdresse(e.target.value)} />
          <Input label="Ville" placeholder="Abidjan" value={ville} onChange={(e) => setVille(e.target.value)} required />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Annuler</Button>
            <Button type="submit">Enregistrer le POS</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
