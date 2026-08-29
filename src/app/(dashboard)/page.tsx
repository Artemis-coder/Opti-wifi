'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Ticket, 
  Banknote, 
  ArrowUpRight, 
  ArrowDownRight, 
  Store, 
  Receipt, 
  PlusCircle, 
  ArrowLeftRight 
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatCurrencyFCFA, formatNumber } from '@/lib/utils/format';
import { useAuthStore } from '@/lib/stores/authStore';

export default function DashboardPage() {
  const { user } = useAuthStore();

  // Mock initial KPIs for immediate rendering
  const kpis = {
    ticketsVendusTotal: 14250,
    chiffreAffairesTotal: 7125000,
    montantACollecter: 1250000,
    montantCollecteTotal: 5875000,
    ecartTotal: -25000,
    posActifsCount: 18,
  };

  const recentCollections = [
    { id: '1', pos: 'POS Cocody St Jean', collecteur: 'Kouassi Jean', montant: 450000, statut: 'validee', date: '29 Aug 2026' },
    { id: '2', pos: 'POS Yopougon Maroc', collecteur: 'Diallo Oumar', montant: 620000, statut: 'validee', date: '29 Aug 2026' },
    { id: '3', pos: 'POS Marcory Zone 4', collecteur: 'Kouassi Jean', montant: 310000, statut: 'brouillon', date: '28 Aug 2026' },
    { id: '4', pos: 'POS Plateau Centre', collecteur: 'Yao Brice', montant: 890000, statut: 'validee', date: '28 Aug 2026' },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#0b1a3a] to-[#162e63] p-6 rounded-2xl text-white shadow-lg border border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Bienvenue, {user?.nom || 'Administrateur'} 👋
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Voici l'aperçu consolidé des ventes et des collectes de tickets Wi-Fi aujourd'hui.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/collections/new">
            <Button variant="secondary" size="md" className="gap-2">
              <PlusCircle className="w-4 h-4" />
              Nouvelle Collecte
            </Button>
          </Link>
          {user?.role === 'administrateur' && (
            <Link href="/allocations/new">
              <Button variant="outline" size="md" className="gap-2 bg-white/10 text-white border-white/20 hover:bg-white/20">
                <ArrowLeftRight className="w-4 h-4" />
                Allouer Tickets
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Tickets Vendus */}
        <Card className="border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tickets Vendus</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Ticket className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {formatNumber(kpis.ticketsVendusTotal)}
            </p>
            <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600">
              <ArrowUpRight className="w-4 h-4" />
              <span>+12.4% vs mois dernier</span>
            </div>
          </div>
        </Card>

        {/* KPI 2: Chiffre d'Affaires */}
        <Card className="border-l-4 border-l-blue-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Chiffre d'Affaires</span>
            <div className="p-2 rounded-lg bg-blue-900/10 text-blue-900 dark:text-blue-400">
              <Banknote className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {formatCurrencyFCFA(kpis.chiffreAffairesTotal)}
            </p>
            <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600">
              <ArrowUpRight className="w-4 h-4" />
              <span>+8.2% ce mois</span>
            </div>
          </div>
        </Card>

        {/* KPI 3: Montant Collecté */}
        <Card className="border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Encaissé</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {formatCurrencyFCFA(kpis.montantCollecteTotal)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Reste à collecter : <span className="font-semibold text-amber-600">{formatCurrencyFCFA(kpis.montantACollecter)}</span>
            </p>
          </div>
        </Card>

        {/* KPI 4: Écart Global */}
        <Card className="border-l-4 border-l-red-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Écart / Différence</span>
            <div className="p-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-red-600">
              {formatCurrencyFCFA(kpis.ecartTotal)}
            </p>
            <div className="flex items-center justify-between mt-1 text-xs text-slate-500">
              <span>POS Actifs</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{kpis.posActifsCount} points</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Grid: Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Recent Collections */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Derniers Encaissements</h2>
            <Link href="/collections" className="text-xs font-semibold text-amber-600 hover:text-amber-700">
              Voir tout →
            </Link>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Point de Vente</th>
                    <th className="px-4 py-3">Collecteur</th>
                    <th className="px-4 py-3">Montant Encaissé</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                  {recentCollections.map((col) => (
                    <tr key={col.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{col.pos}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{col.collecteur}</td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{formatCurrencyFCFA(col.montant)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={col.statut === 'validee' ? 'success' : 'warning'}>
                          {col.statut === 'validee' ? 'Validée' : 'Brouillon'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{col.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right Column: Quick Links & Summary */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Raccourcis Métier</h2>
          
          <Card className="space-y-3">
            <Link
              href="/collections/new"
              className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 hover:scale-[1.01] transition"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500 text-slate-950">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Nouvelle Collecte</p>
                  <p className="text-xs text-slate-500">Saisir un encaissement de caisse</p>
                </div>
              </div>
              <span className="text-amber-600 font-bold">→</span>
            </Link>

            <Link
              href="/pos"
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 hover:scale-[1.01] transition"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-900 text-white">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Points de Vente</p>
                  <p className="text-xs text-slate-500">Gérer le réseau de distribution</p>
                </div>
              </div>
              <span className="text-slate-400 font-bold">→</span>
            </Link>

            <Link
              href="/tickets"
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 hover:scale-[1.01] transition"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-600 text-white">
                  <Ticket className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Types de Tickets</p>
                  <p className="text-xs text-slate-500">Consulter et modifier les tarifs</p>
                </div>
              </div>
              <span className="text-slate-400 font-bold">→</span>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
