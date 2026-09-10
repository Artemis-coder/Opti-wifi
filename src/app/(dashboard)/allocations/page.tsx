'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeftRight, Plus, Store, Ticket, Loader2, Calendar, User, FileText, Repeat, AlertTriangle, Trash2, Edit } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { formatCurrencyFCFA, formatDateFR } from '@/lib/utils/format';
import { PointOfSale, TicketAllocation, TicketType, Profile, AllocationStatut } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores/authStore';
import { toast } from 'sonner';

export default function AllocationsPage() {
  const [loading, setLoading] = useState(true);
  const [allocations, setAllocations] = useState<TicketAllocation[]>([]);
  const [posList, setPosList] = useState<PointOfSale[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedPosId, setSelectedPosId] = useState<string>('all');
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editModalAlloc, setEditModalAlloc] = useState<TicketAllocation | null>(null);
  const [editQuantite, setEditQuantite] = useState(0);
  const [editNotes, setEditNotes] = useState('');
  const [editStatut, setEditStatut] = useState<AllocationStatut>('fonctionnel');
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const { user } = useAuthStore();
  const supabase = createClient();
  const isAdmin = user?.role === 'administrateur';

  useEffect(() => {
    async function loadData() {
      if (!user?.organization_id) return;
      setLoading(true);

      const [posRes, allocRes, ticketRes, profileRes] = await Promise.all([
        supabase.from('points_of_sale').select('*').eq('organization_id', user.organization_id).order('nom'),
        supabase.from('ticket_allocations').select('*, pos:points_of_sale(*), ticket_type:ticket_types(*)').eq('organization_id', user.organization_id).order('created_at', { ascending: false }),
        supabase.from('ticket_types').select('*').eq('organization_id', user.organization_id).order('nom'),
        supabase.from('profiles').select('*').eq('organization_id', user.organization_id),
      ]);

      if (posRes.data) setPosList(posRes.data);
      if (allocRes.data) setAllocations(allocRes.data);
      if (ticketRes.data) setTicketTypes(ticketRes.data);
      if (profileRes.data) setProfiles(profileRes.data);

      setLoading(false);
    }

    loadData();
  }, [user?.organization_id, supabase]);

  const filteredAllocations = selectedPosId === 'all'
    ? allocations
    : allocations.filter((a) => a.pos_id === selectedPosId);

  const totalAllocations = filteredAllocations.length;
  const exchangedAllocations = filteredAllocations.filter(
    (a) => a.type === 'exchange_return' || a.type === 'exchange_receive'
  );
  const totalExchangedTickets = exchangedAllocations.reduce((sum, a) => {
    const qty = a.type === 'exchange_return' ? -a.quantite : a.quantite;
    return sum + Math.abs(qty);
  }, 0);
  const nonFunctionalTickets = filteredAllocations
    .filter((a) => a.statut === 'non_fonctionnel')
    .reduce((sum, a) => sum + a.quantite, 0);

  const allocationsByPos = filteredAllocations.reduce((acc, alloc) => {
    const posId = alloc.pos_id;
    if (!acc[posId]) {
      acc[posId] = {
        pos: alloc.pos,
        allocations: [],
      };
    }
    acc[posId].allocations.push(alloc);
    return acc;
  }, {} as Record<string, { pos: PointOfSale | undefined; allocations: TicketAllocation[] }>);

  const getAllocatorName = (allouePar?: string) => {
    if (!allouePar) return 'Système';
    const profile = profiles.find((p) => p.id === allouePar);
    return profile?.nom || 'Utilisateur inconnu';
  };

  const getTicketTypeName = (ticketTypeId: string) => {
    const ticket = ticketTypes.find((t) => t.id === ticketTypeId);
    return ticket?.nom || 'Type inconnu';
  };

  const getTicketTypePrix = (ticketTypeId: string) => {
    const ticket = ticketTypes.find((t) => t.id === ticketTypeId);
    return ticket?.prix || 0;
  };

  const getAllocationTypeLabel = (alloc: TicketAllocation) => {
    switch (alloc.type) {
      case 'exchange_return':
        return { label: 'Rendu (Échange)', color: 'text-red-600' };
      case 'exchange_receive':
        return { label: 'Reçu (Échange)', color: 'text-emerald-600' };
      default:
        return { label: 'Allocation', color: 'text-amber-600' };
    }
  };

  const openEditModal = (alloc: TicketAllocation) => {
    setEditModalAlloc(alloc);
    setEditQuantite(alloc.quantite);
    setEditNotes(alloc.notes || '');
    setEditStatut(alloc.statut || 'fonctionnel');
  };

  const closeEditModal = () => {
    setEditModalAlloc(null);
    setEditQuantite(0);
    setEditNotes('');
    setEditStatut('fonctionnel');
    setIsSavingEdit(false);
  };

  const handleSaveEdit = async () => {
    if (!editModalAlloc || !user?.organization_id) return;
    setIsSavingEdit(true);

    try {
      const res = await fetch('/api/allocations/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: user.organization_id,
          updates: [
            {
              id: editModalAlloc.id,
              quantite: editQuantite,
              notes: editNotes || null,
              statut: editStatut,
            },
          ],
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || result.message || 'Échec de la mise à jour.');
      }

      setAllocations((prev) =>
        prev.map((a) =>
          a.id === editModalAlloc.id
            ? { ...a, quantite: editQuantite, notes: editNotes || null, statut: editStatut }
            : a
        )
      );

      toast.success('Allocation modifiée avec succès.');
      closeEditModal();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la modification.';
      toast.error(message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleIndividualDelete = async () => {
    if (!deleteConfirmId || !user?.organization_id) return;
    setIsDeleting(true);

    try {
      const res = await fetch('/api/allocations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: user.organization_id,
          allocation_ids: [deleteConfirmId],
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || result.message || 'Échec de la suppression.');
      }

      setAllocations((prev) => prev.filter((a) => a.id !== deleteConfirmId));
      toast.success('Allocation supprimée.');
      setDeleteConfirmId(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la suppression.';
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!user?.organization_id) return;
    setIsBulkDeleting(true);

    try {
      const res = await fetch('/api/allocations/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: user.organization_id,
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || result.message || 'Échec de la suppression globale.');
      }

      setAllocations([]);
      toast.success('Toutes les allocations ont été supprimées.');
      setBulkDeleteModalOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la suppression globale.';
      toast.error(message);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
        Chargement des allocations...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6 text-amber-500" />
            Suivi des Allocations
          </h1>
          <p className="text-xs text-slate-500">Historique complet des allocations de tickets par point de vente.</p>
        </div>
        <Link href="/allocations/new">
          <Button className="gap-2 font-semibold">
            <Plus className="w-4 h-4" />
            Nouvelle Allocation
          </Button>
        </Link>
        <Link href="/allocations/exchange">
          <Button variant="outline" className="gap-2 font-semibold">
            <Repeat className="w-4 h-4" />
            Échange de Tickets
          </Button>
        </Link>
        {isAdmin && (
          <Button
            variant="danger"
            className="gap-2 font-semibold"
            onClick={() => setBulkDeleteModalOpen(true)}
          >
            <Trash2 className="w-4 h-4" />
            Supprimer Tout
          </Button>
        )}
      </div>

      {/* Filter */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Filtrer par Point de Vente
            </label>
            <select
              value={selectedPosId}
              onChange={(e) => setSelectedPosId(e.target.value)}
              className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium"
            >
              <option value="all">Tous les points de vente</option>
              {posList.map((pos) => (
                <option key={pos.id} value={pos.id}>
                  {pos.nom}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Allocations</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-3">{totalAllocations}</p>
          <p className="text-xs text-slate-500 mt-1">Allocations enregistrées</p>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tickets Échangés</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
              <Repeat className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-3">{totalExchangedTickets}</p>
          <p className="text-xs text-slate-500 mt-1">Tickets impliqués dans des échanges</p>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tickets Non Fonctionnels</span>
            <div className="p-2 rounded-lg bg-red-500/10 text-red-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-3">{nonFunctionalTickets}</p>
          <p className="text-xs text-slate-500 mt-1">Tickets rendus (défauts)</p>
        </Card>
      </div>

      {/* Allocations by POS */}
      {Object.keys(allocationsByPos).length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
            <ArrowLeftRight className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucune allocation trouvée</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {selectedPosId === 'all'
              ? 'Aucune allocation n\'a été effectuée pour le moment.'
              : 'Ce point de vente n\'a aucune allocation enregistrée.'}
          </p>
          <Link href="/allocations/new">
            <Button variant="secondary" className="font-bold gap-2">
              <Plus className="w-4 h-4" /> Créer une allocation
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(allocationsByPos).map(([posId, { pos, allocations: posAllocations }]) => (
            <Card key={posId} className="overflow-hidden">
              {/* POS Header */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-900/10 text-blue-900 dark:text-blue-400">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {pos?.nom || 'Point de vente inconnu'}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {pos?.ville || ''} {pos?.adresse ? `• ${pos.adresse}` : ''}
                      </p>
                    </div>
                  </div>
                  <Badge variant="neutral">
                    {posAllocations.length} allocation{posAllocations.length > 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>

              {/* Allocations Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Nature</th>
                      <th className="px-4 py-3">Type de Ticket</th>
                      <th className="px-4 py-3">Quantité</th>
                      <th className="px-4 py-3">Montant</th>
                      <th className="px-4 py-3">Alloué par</th>
                      <th className="px-4 py-3">Notes</th>
                      {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                    {posAllocations.map((alloc) => {
                      const typeInfo = getAllocationTypeLabel(alloc);
                      const isReturn = alloc.type === 'exchange_return';
                      const isReceive = alloc.type === 'exchange_receive';
                      return (
                        <tr key={alloc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {formatDateFR(alloc.created_at)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={isReturn ? 'danger' : isReceive ? 'success' : 'info'}>
                              {typeInfo.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Ticket className="w-3.5 h-3.5 text-emerald-600" />
                              {getTicketTypeName(alloc.ticket_type_id)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-bold ${
                              isReturn ? 'text-red-600' : isReceive ? 'text-emerald-600' : 'text-slate-900 dark:text-white'
                            }`}>
                              {isReturn ? `-${alloc.quantite}` : alloc.quantite}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {formatCurrencyFCFA(alloc.quantite * getTicketTypePrix(alloc.ticket_type_id))}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              {getAllocatorName(alloc.alloue_par)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {alloc.notes ? (
                              <div className="flex items-center gap-1">
                                <FileText className="w-3.5 h-3.5 text-slate-400" />
                                <span className="truncate max-w-[200px]">{alloc.notes}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => openEditModal(alloc)}
                                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                                  title="Modifier"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(alloc.id)}
                                  className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* POS Footer Summary */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400 font-medium">
                  Total pour ce POS :
                </span>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {posAllocations.reduce((sum, a) => {
                      const qty = a.type === 'exchange_return' ? -a.quantite : a.quantite;
                      return sum + qty;
                    }, 0)} tickets net
                  </span>
                  <span className="font-bold text-amber-600">
                    {formatCurrencyFCFA(
                      posAllocations.reduce(
                        (sum, a) => {
                          const qty = a.type === 'exchange_return' ? -a.quantite : a.quantite;
                          return sum + qty * getTicketTypePrix(a.ticket_type_id);
                        },
                        0
                      )
                    )}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Bulk Delete Modal */}
      <Modal isOpen={bulkDeleteModalOpen} onClose={() => setBulkDeleteModalOpen(false)} title="Supprimer toutes les allocations">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-800 dark:text-red-300">
              Cette action est irréversible. Toutes les allocations de votre organisation seront supprimées définitivement.
            </p>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Voulez-vous vraiment supprimer toutes les allocations ? Cette action ne peut pas être annulée.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setBulkDeleteModalOpen(false)} disabled={isBulkDeleting}>
              Annuler
            </Button>
            <Button variant="danger" onClick={handleBulkDelete} isLoading={isBulkDeleting}>
              Supprimer Tout
            </Button>
          </div>
        </div>
      </Modal>

      {/* Individual Delete Modal */}
      <Modal isOpen={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="Supprimer l'allocation">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Voulez-vous vraiment supprimer cette allocation ? Cette action ne peut pas être annulée.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setDeleteConfirmId(null)} disabled={isDeleting}>
              Annuler
            </Button>
            <Button variant="danger" onClick={handleIndividualDelete} isLoading={isDeleting}>
              Supprimer
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Allocation Modal */}
      <Modal isOpen={!!editModalAlloc} onClose={closeEditModal} title="Modifier l'allocation">
        {editModalAlloc && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Quantité
              </label>
              <input
                type="number"
                min={0}
                value={editQuantite}
                onChange={(e) => setEditQuantite(Math.max(0, parseInt(e.target.value || '0', 10)))}
                className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Statut
              </label>
              <select
                value={editStatut}
                onChange={(e) => setEditStatut(e.target.value as AllocationStatut)}
                className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium"
              >
                <option value="fonctionnel">Fonctionnel</option>
                <option value="non_fonctionnel">Non fonctionnel</option>
                <option value="en_reparation">En réparation</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Notes
              </label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium resize-none"
                placeholder="Notes optionnelles..."
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={closeEditModal} disabled={isSavingEdit}>
                Annuler
              </Button>
              <Button onClick={handleSaveEdit} isLoading={isSavingEdit}>
                Enregistrer
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}