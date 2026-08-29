'use client';

import React, { useState, useEffect } from 'react';
import { Store, Plus, Search, MapPin, UserCheck, Loader2, Inbox } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PointOfSale, Profile } from '@/types/database';
import { createClient } from '@/lib/supabase/client';

export default function PosPage() {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  const [posList, setPosList] = useState<PointOfSale[]>([]);
  const [collectors, setCollectors] = useState<Profile[]>([]);

  // Form State
  const [nom, setNom] = useState('');
  const [adresse, setAdresse] = useState('');
  const [ville, setVille] = useState('Abidjan');
  const [collecteurId, setCollecteurId] = useState('');

  const supabase = createClient();

  const loadData = async () => {
    setLoading(true);
    // 1. Fetch POS from Supabase DB
    const { data: posData } = await supabase
      .from('points_of_sale')
      .select('*, collecteur:profiles(*)');

    // 2. Fetch Collectors for assignment dropdown
    const { data: colData } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'collecteur');

    if (colData) setCollectors(colData);
    setPosList(posData || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredPos = posList.filter((p) =>
    p.nom.toLowerCase().includes(search.toLowerCase()) ||
    p.ville.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom) return;

    setCreating(true);
    setFormError('');

    const newPosData = {
      nom,
      adresse,
      ville,
      statut: 'actif' as const,
      collecteur_id: collecteurId || null,
    };

    const { data, error } = await supabase
      .from('points_of_sale')
      .insert(newPosData)
      .select('*, collecteur:profiles(*)')
      .single();

    setCreating(false);

    if (error) {
      // Show exact Supabase error so user/dev can debug
      console.error('POS insert error:', error);
      setFormError(`Erreur d'enregistrement : ${error.message} (code: ${error.code})`);
      return;
    }

    if (data) {
      setPosList([data, ...posList]);
    }

    setNom('');
    setAdresse('');
    setVille('Abidjan');
    setCollecteurId('');
    setFormError('');
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Points de Vente (POS)</h1>
          <p className="text-xs text-slate-500">Gérez le réseau de distribution et l'attribution des collecteurs.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2 font-semibold">
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

      {/* Grid POS Cards or Empty State */}
      {loading ? (
        <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          Chargement des points de vente...
        </div>
      ) : filteredPos.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
            <Store className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucun point de vente trouvé</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Vous n'avez pas encore configuré de point de vente. Ajoutez votre premier emplacement pour démarrer les encaissements.
          </p>
          <Button onClick={() => setIsModalOpen(true)} variant="secondary" className="font-bold gap-2">
            <Plus className="w-4 h-4" /> Ajouter mon premier POS
          </Button>
        </Card>
      ) : (
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
                  <span>Collecteur : <strong className="text-slate-800 dark:text-slate-200">{pos.collecteur?.nom || 'Non attribué'}</strong></span>
                </div>
                <span className="text-[11px] text-slate-400">ID #{pos.id.slice(0, 4)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add POS Modal */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setFormError(''); }} title="Créer un Point de Vente">
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {formError}
            </div>
          )}
          <Input label="Nom du POS" placeholder="ex: POS Cocody St Jean" value={nom} onChange={(e) => setNom(e.target.value)} required />
          <Input label="Adresse / Emplacement" placeholder="ex: Rue des Jardins" value={adresse} onChange={(e) => setAdresse(e.target.value)} />
          <Input label="Ville" placeholder="Abidjan" value={ville} onChange={(e) => setVille(e.target.value)} required />
          
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Collecteur Attribué (Optionnel)
            </label>
            <select
              value={collecteurId}
              onChange={(e) => setCollecteurId(e.target.value)}
              className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
            >
              <option value="">Aucun collecteur attribué</option>
              {collectors.map((c) => (
                <option key={c.id} value={c.id}>{c.nom} ({c.email})</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => { setIsModalOpen(false); setFormError(''); }}>Annuler</Button>
            <Button type="submit" isLoading={creating}>Enregistrer le POS</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
