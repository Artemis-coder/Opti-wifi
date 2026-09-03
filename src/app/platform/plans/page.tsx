'use client';

import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Plus,
  Search,
  Edit,
  Trash2,
  Loader2,
  ToggleLeft,
  ToggleRight,
  CheckCircle,
  PauseCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { toast } from 'sonner';
import { formatCurrencyFCFA } from '@/lib/utils/format';
import { SubscriptionPlan, BillingPeriod, PlanStatus } from '@/types/platform';

const BILLING_PERIODS: { value: BillingPeriod; label: string }[] = [
  { value: 'monthly', label: 'Mensuelle' },
  { value: 'quarterly', label: 'Trimestrielle' },
  { value: 'semiannual', label: 'Semestrielle' },
  { value: 'annual', label: 'Annuelle' },
];

const PLAN_STATUSES: { value: PlanStatus; label: string }[] = [
  { value: 'active', label: 'Actif' },
  { value: 'inactive', label: 'Inactif' },
];

const CURRENCIES = [
  { value: 'XOF', label: 'FCFA (XOF)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'USD', label: 'Dollar US (USD)' },
];

export default function PlatformPlansPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCurrency, setFormCurrency] = useState('XOF');
  const [formPeriod, setFormPeriod] = useState<BillingPeriod>('monthly');
  const [formTrialDays, setFormTrialDays] = useState('');
  const [formMaxUsers, setFormMaxUsers] = useState('');
  const [formMaxPos, setFormMaxPos] = useState('');
  const [formMaxTickets, setFormMaxTickets] = useState('');
  const [formStatus, setFormStatus] = useState<PlanStatus>('active');

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    setLoading(true);
    try {
      const res = await fetch('/api/platform/plans');
      const result = await res.json();
      if (res.ok) {
        setPlans(result.data);
      } else {
        toast.error(result.error || 'Erreur de chargement');
      }
    } catch {
      toast.error('Erreur de chargement des plans');
    } finally {
      setLoading(false);
    }
  }

  const resetForm = () => {
    setFormName('');
    setFormDesc('');
    setFormPrice('');
    setFormCurrency('XOF');
    setFormPeriod('monthly');
    setFormTrialDays('');
    setFormMaxUsers('');
    setFormMaxPos('');
    setFormMaxTickets('');
    setFormStatus('active');
    setEditingPlan(null);
  };

  const handleOpenModal = (plan?: SubscriptionPlan) => {
    if (plan) {
      setEditingPlan(plan);
      setFormName(plan.name);
      setFormDesc(plan.description || '');
      setFormPrice(String(plan.price));
      setFormCurrency(plan.currency);
      setFormPeriod(plan.billing_period);
      setFormTrialDays(plan.trial_days?.toString() || '');
      setFormMaxUsers(plan.max_users?.toString() || '');
      setFormMaxPos(plan.max_points_of_sale?.toString() || '');
      setFormMaxTickets(plan.max_tickets_per_month?.toString() || '');
      setFormStatus(plan.status);
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formPrice) {
      toast.error('Nom et prix sont requis');
      return;
    }

    setSubmitting(true);

    const planData = {
      name: formName.trim(),
      description: formDesc.trim() || null,
      price: parseFloat(formPrice),
      currency: formCurrency,
      billing_period: formPeriod,
      trial_days: formTrialDays ? parseInt(formTrialDays) : 14,
      max_users: formMaxUsers ? parseInt(formMaxUsers) : null,
      max_points_of_sale: formMaxPos ? parseInt(formMaxPos) : null,
      max_tickets_per_month: formMaxTickets ? parseInt(formMaxTickets) : null,
      features: null,
      status: formStatus,
    };

    let res;
    if (editingPlan) {
      res = await fetch(`/api/platform/plans/${editingPlan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planData),
      });
    } else {
      res = await fetch('/api/platform/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planData),
      });
    }

    const result = await res.json();
    if (res.ok && result.data) {
      if (editingPlan) {
        setPlans(plans.map((p) => (p.id === editingPlan.id ? result.data : p)));
        toast.success('Plan mis à jour avec succès');
      } else {
        setPlans([result.data, ...plans]);
        toast.success('Plan créé avec succès');
      }
      handleCloseModal();
    } else {
      toast.error(result.error || 'Erreur');
    }

    setSubmitting(false);
  };

  const handleDelete = async (plan: SubscriptionPlan) => {
    if (!window.confirm(`Supprimer le plan "${plan.name}" ?`)) return;

    const res = await fetch(`/api/platform/plans/${plan.id}`, { method: 'DELETE' });
    const result = await res.json();
    if (res.ok) {
      setPlans(plans.filter((p) => p.id !== plan.id));
      toast.success('Plan supprimé');
    } else {
      toast.error(result.error || 'Erreur');
    }
  };

  const handleToggleStatus = async (plan: SubscriptionPlan) => {
    const newStatus: PlanStatus = plan.status === 'active' ? 'inactive' : 'active';
    const res = await fetch(`/api/platform/plans/${plan.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    const result = await res.json();
    if (res.ok && result.data) {
      setPlans(plans.map((p) => (p.id === plan.id ? result.data : p)));
      toast.success(`Plan ${plan.status === 'active' ? 'désactivé' : 'activé'}`);
    } else {
      toast.error(result.error || 'Erreur');
    }
  };

  const filteredPlans = plans.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
        <span>Chargement des plans...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Plans Tarifaires</h1>
          <p className="text-xs text-slate-500">Configurez les offres commerciales de la plateforme SaaS.</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="gap-2 font-semibold">
          <Plus className="w-4 h-4" /> Nouveau Plan
        </Button>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un plan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </Card>

      {/* Plans Grid */}
      {filteredPlans.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <Wallet className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucun plan trouvé</h3>
          <p className="text-xs text-slate-500">Créez votre premier plan tarifaire pour commencer.</p>
          <Button onClick={() => handleOpenModal()} variant="secondary" className="font-bold gap-2">
            <Plus className="w-4 h-4" /> Nouveau Plan
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlans.map((plan) => (
            <Card key={plan.id} className="space-y-4 border-l-4 border-l-amber-500">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">{plan.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">{plan.description || 'Sans description'}</p>
                </div>
                <Badge variant={plan.status === 'active' ? 'success' : 'neutral'}>
                  {plan.status === 'active' ? 'Actif' : 'Inactif'}
                </Badge>
              </div>

              <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {formatCurrencyFCFA(plan.price)}
              </div>

              <div className="text-xs text-slate-500 space-y-1">
                <p><span className="font-semibold">Période :</span> {BILLING_PERIODS.find((p) => p.value === plan.billing_period)?.label || plan.billing_period}</p>
                {plan.trial_days && plan.trial_days > 0 && (
                  <p><span className="font-semibold">Essai :</span> {plan.trial_days} jours</p>
                )}
                {plan.max_users && (
                  <p><span className="font-semibold">Utilisateurs :</span> {plan.max_users === -1 ? 'Illimités' : plan.max_users}</p>
                )}
                {plan.max_points_of_sale && (
                  <p><span className="font-semibold">POS :</span> {plan.max_points_of_sale === -1 ? 'Illimités' : plan.max_points_of_sale}</p>
                )}
                {plan.max_tickets_per_month && (
                  <p><span className="font-semibold">Tickets/mois :</span> {plan.max_tickets_per_month === -1 ? 'Illimités' : plan.max_tickets_per_month}</p>
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <Button variant="ghost" size="sm" className="flex-1 gap-1" onClick={() => handleToggleStatus(plan)}>
                  {plan.status === 'active' ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
                  {plan.status === 'active' ? 'Désactiver' : 'Activer'}
                </Button>
                <Button variant="ghost" size="sm" className="p-1 h-8 w-8" onClick={() => handleOpenModal(plan)}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="p-1 h-8 w-8 text-red-600 hover:text-red-700" onClick={() => handleDelete(plan)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Plan Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingPlan ? 'Modifier le Plan' : 'Créer un Plan Tarifaire'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nom du plan"
            placeholder="ex: Basic"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
          />
          <Input
            label="Description"
            placeholder="Description du plan..."
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Prix"
              type="number"
              placeholder="0"
              value={formPrice}
              onChange={(e) => setFormPrice(e.target.value)}
              required
            />
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Devise
              </label>
              <select
                value={formCurrency}
                onChange={(e) => setFormCurrency(e.target.value)}
                className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Période de facturation
            </label>
            <select
              value={formPeriod}
              onChange={(e) => setFormPeriod(e.target.value as BillingPeriod)}
              className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
            >
              {BILLING_PERIODS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <Input
            label="Jours d'essai"
            type="number"
            placeholder="14"
            value={formTrialDays}
            onChange={(e) => setFormTrialDays(e.target.value)}
          />
          <Input
            label="Max Utilisateurs (-1 = illimité)"
            type="number"
            placeholder="-1"
            value={formMaxUsers}
            onChange={(e) => setFormMaxUsers(e.target.value)}
          />
          <Input
            label="Max Points de Vente (-1 = illimité)"
            type="number"
            placeholder="-1"
            value={formMaxPos}
            onChange={(e) => setFormMaxPos(e.target.value)}
          />
          <Input
            label="Max Tickets/mois (-1 = illimité)"
            type="number"
            placeholder="-1"
            value={formMaxTickets}
            onChange={(e) => setFormMaxTickets(e.target.value)}
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Statut
            </label>
            <select
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value as PlanStatus)}
              className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
            >
              {PLAN_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={handleCloseModal} disabled={submitting}>
              Annuler
            </Button>
            <Button type="submit" variant="secondary" isLoading={submitting}>
              {editingPlan ? 'Mettre à jour' : 'Créer le plan'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
