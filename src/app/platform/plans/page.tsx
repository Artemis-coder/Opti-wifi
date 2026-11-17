'use client';

import React, { useState, useEffect } from 'react';
import {
  Wallet,
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
import { CustomSelect } from '@/components/ui/CustomSelect';
import { confirmAction } from '@/components/ui/ConfirmDialog';
import { AddButton } from '@/components/ui/AddButton';
import { MAX_PLAN_FEATURES, normalizePlanFeatures, planFeatureList } from '@/lib/plan-features';

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
  const [formMaxCollectors, setFormMaxCollectors] = useState('');
  // Accès « point de vente » : 0 = non inclus, vide ou -1 = illimité
  const [formMaxPosAccounts, setFormMaxPosAccounts] = useState('');
  const [formMaxTickets, setFormMaxTickets] = useState('');
  const [formFeatures, setFormFeatures] = useState('');
  const [formStatus, setFormStatus] = useState<PlanStatus>('active');

  // Chargement initial (`loading` vaut déjà true)
  useEffect(() => {
    (async () => {
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
    })();
  }, []);

  const resetForm = () => {
    setFormName('');
    setFormDesc('');
    setFormPrice('');
    setFormCurrency('XOF');
    setFormPeriod('monthly');
    setFormTrialDays('');
    setFormMaxUsers('');
    setFormMaxPos('');
    setFormMaxCollectors('');
    setFormMaxPosAccounts('0');
    setFormMaxTickets('');
    setFormFeatures('');
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
      setFormMaxCollectors(plan.max_collectors?.toString() || '');
      setFormMaxPosAccounts(plan.max_pos_accounts?.toString() ?? '');
      setFormMaxTickets(plan.max_tickets_per_month?.toString() || '');
      setFormFeatures(planFeatureList(plan.features).join('\n'));
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
      max_collectors: formMaxCollectors ? parseInt(formMaxCollectors) : null,
      max_pos_accounts: formMaxPosAccounts.trim() !== '' ? parseInt(formMaxPosAccounts) : null,
      max_tickets_per_month: formMaxTickets ? parseInt(formMaxTickets) : null,
      features: normalizePlanFeatures(formFeatures.split('\n')),
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
        setPlans(plans.map((p: SubscriptionPlan) => (p.id === editingPlan.id ? result.data : p)));
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
    if (!(await confirmAction(`Supprimer le forfait « ${plan.name} » ?`, { title: 'Supprimer le forfait', confirmLabel: 'Supprimer' }))) return;

    const res = await fetch(`/api/platform/plans/${plan.id}`, { method: 'DELETE' });
    const result = await res.json();
    if (res.ok) {
      setPlans(plans.filter((p: SubscriptionPlan) => p.id !== plan.id));
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
      setPlans(plans.map((p: SubscriptionPlan) => (p.id === plan.id ? result.data : p)));
      toast.success(`Plan ${plan.status === 'active' ? 'désactivé' : 'activé'}`);
    } else {
      toast.error(result.error || 'Erreur');
    }
  };

  const filteredPlans = plans.filter((p: SubscriptionPlan) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="py-10 flex justify-center items-center gap-2 text-muted text-sm font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
        <span>Chargement des plans...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Plans Tarifaires</h1>
          <p className="text-xs text-muted">Configurez les offres commerciales de la plateforme SaaS.</p>
        </div>
        <AddButton what="un forfait" onClick={() => handleOpenModal()} />
      </div>

      {/* Search */}
      <Card>
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted" />
          <input
            type="text"
            placeholder="Rechercher un plan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input--primary w-full pl-10 pr-3"
          />
        </div>
      </Card>

      {/* Plans Grid */}
      {filteredPlans.length === 0 ? (
        <Card className="text-center space-y-3 py-8">
          <Wallet className="w-12 h-12 text-muted mx-auto" />
          <h3 className="text-base font-semibold text-foreground">Aucun plan trouvé</h3>
          <p className="text-xs text-muted">Créez votre premier plan tarifaire pour commencer.</p>
          <AddButton what="un forfait" onClick={() => handleOpenModal()} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredPlans.map((plan: SubscriptionPlan) => (
            <Card key={plan.id} className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg text-foreground">{plan.name}</h3>
                  <p className="text-xs text-muted mt-1">{plan.description || 'Sans description'}</p>
                </div>
                <Badge variant={plan.status === 'active' ? 'success' : 'neutral'}>
                  {plan.status === 'active' ? 'Actif' : 'Inactif'}
                </Badge>
              </div>

              <div className="text-3xl font-semibold text-foreground">
                {formatCurrencyFCFA(plan.price)}
              </div>

              <div className="text-xs text-muted space-y-1">
                <p><span className="font-semibold">Période :</span> {BILLING_PERIODS.find((p: { value: BillingPeriod; label: string }) => p.value === plan.billing_period)?.label || plan.billing_period}</p>
                {plan.trial_days && plan.trial_days > 0 && (
                  <p><span className="font-semibold">Essai :</span> {plan.trial_days} jours</p>
                )}
                {plan.max_users && (
                  <p><span className="font-semibold">Utilisateurs :</span> {plan.max_users === -1 ? 'Illimités' : plan.max_users}</p>
                )}
                {plan.max_points_of_sale && (
                  <p><span className="font-semibold">POS :</span> {plan.max_points_of_sale === -1 ? 'Illimités' : plan.max_points_of_sale}</p>
                )}
                {plan.max_collectors !== null && plan.max_collectors !== undefined && (
                  <p>
                    <span className="font-semibold">Collecteurs :</span>{' '}
                    {plan.max_collectors < 0 ? 'Illimités' : plan.max_collectors === 0 ? 'Aucun' : plan.max_collectors}
                  </p>
                )}
                <p>
                  <span className="font-semibold">Accès points de vente :</span>{' '}
                  {plan.max_pos_accounts === 0
                    ? 'Non inclus'
                    : plan.max_pos_accounts === null || plan.max_pos_accounts === undefined || plan.max_pos_accounts < 0
                      ? 'Illimités'
                      : plan.max_pos_accounts}
                </p>
                {plan.max_tickets_per_month && (
                  <p><span className="font-semibold">Tickets/mois :</span> {plan.max_tickets_per_month === -1 ? 'Illimités' : plan.max_tickets_per_month}</p>
                )}
              </div>

              {planFeatureList(plan.features).length > 0 && (
                <ul className="space-y-1 text-xs text-muted">
                  {planFeatureList(plan.features).map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-accent" /> {f}
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex gap-2 pt-2 border-t border-border">
                <Button variant="ghost" size="sm" className="flex-1" onClick={() => handleToggleStatus(plan)}>
                  {plan.status === 'active' ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
                  {plan.status === 'active' ? 'Désactiver' : 'Activer'}
                </Button>
                <Button isIconOnly variant="ghost" size="sm" onClick={() => handleOpenModal(plan)}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button isIconOnly variant="danger-soft" size="sm" onClick={() => handleDelete(plan)}>
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
              <label className="block text-xs font-semibold text-foreground">
                Devise
              </label>
              <CustomSelect
                value={formCurrency}
                onChange={(v) => setFormCurrency(v)}
                options={[
                  ...CURRENCIES.map((c) => ({ value: c.value, label: c.label })),
                ]}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground">
              Période de facturation
            </label>
            <CustomSelect
              value={formPeriod}
              onChange={(v) => setFormPeriod(v as BillingPeriod)}
              options={[
                ...BILLING_PERIODS.map((p) => ({ value: p.value, label: p.label })),
              ]}
            />
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
            label="Max Collecteurs (-1 = illimité)"
            type="number"
            placeholder="-1"
            value={formMaxCollectors}
            onChange={(e) => setFormMaxCollectors(e.target.value)}
          />
          <Input
            label="Accès points de vente (0 = non inclus, vide ou -1 = illimité)"
            type="number"
            placeholder="0"
            value={formMaxPosAccounts}
            onChange={(e) => setFormMaxPosAccounts(e.target.value)}
            helperText="Comptes en consultation seule que le client peut créer pour ses points de vente."
          />
          <Input
            label="Max Tickets/mois (-1 = illimité)"
            type="number"
            placeholder="-1"
            value={formMaxTickets}
            onChange={(e) => setFormMaxTickets(e.target.value)}
          />

          <div className="space-y-1.5">
            <label htmlFor="plan-features" className="block text-xs font-semibold text-foreground">
              Fonctionnalités incluses (une par ligne)
            </label>
            <textarea
              id="plan-features"
              rows={5}
              value={formFeatures}
              onChange={(e) => setFormFeatures(e.target.value)}
              placeholder={'Rapports & exports CSV\nCommissions des collecteurs\nSupport prioritaire'}
              className="textarea textarea--primary w-full resize-y"
            />
            <p className="text-xs text-muted">
              Affichées sur le site vitrine sous les limites du forfait ({MAX_PLAN_FEATURES} maximum).
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground">
              Statut
            </label>
            <CustomSelect
              value={formStatus}
              onChange={(v) => setFormStatus(v as PlanStatus)}
              options={[
                ...PLAN_STATUSES.map((s) => ({ value: s.value, label: s.label })),
              ]}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleCloseModal} disabled={submitting}>
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
