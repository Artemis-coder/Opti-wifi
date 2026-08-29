'use client';

import React from 'react';
import Link from 'next/link';
import { Receipt, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatCurrencyFCFA, formatDateFR } from '@/lib/utils/format';

export default function CollectionsPage() {
  const collections = [
    { id: '1', pos: 'POS Cocody St Jean', collecteur: 'Kouassi Jean', attendu: 450000, collecte: 450000, diff: 0, statut: 'validee', date: new Date().toISOString() },
    { id: '2', pos: 'POS Yopougon Maroc', collecteur: 'Diallo Oumar', attendu: 650000, collecte: 620000, diff: -30000, statut: 'validee', date: new Date().toISOString() },
    { id: '3', pos: 'POS Marcory Zone 4', collecteur: 'Kouassi Jean', attendu: 310000, collecte: 310000, diff: 0, statut: 'brouillon', date: new Date().toISOString() },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Encaissements & Collectes</h1>
          <p className="text-xs text-slate-500">Historique des levées de caisses et contrôle des écarts.</p>
        </div>
        <Link href="/collections/new">
          <Button variant="secondary" className="gap-2 font-bold">
            <Plus className="w-4 h-4" />
            Nouvelle Collecte de Caisse
          </Button>
        </Link>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Point de Vente</th>
                <th className="px-4 py-3">Collecteur</th>
                <th className="px-4 py-3">Montant Attendu</th>
                <th className="px-4 py-3">Montant Encaissé</th>
                <th className="px-4 py-3">Écart (Diff)</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
              {collections.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{c.pos}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{c.collecteur}</td>
                  <td className="px-4 py-3 font-medium text-slate-600">{formatCurrencyFCFA(c.attendu)}</td>
                  <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{formatCurrencyFCFA(c.collecte)}</td>
                  <td className="px-4 py-3">
                    {c.diff === 0 ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 0 FCFA
                      </span>
                    ) : (
                      <span className="text-red-600 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> {formatCurrencyFCFA(c.diff)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={c.statut === 'validee' ? 'success' : 'warning'}>
                      {c.statut === 'validee' ? 'Validée' : 'Brouillon'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDateFR(c.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
