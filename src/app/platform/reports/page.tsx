'use client';

import React from 'react';
import { BarChart3, FileSpreadsheet, Download } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function PlatformReportsPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Rapports</h1>
        <p className="text-xs text-slate-500">Rapports et indicateurs commerciaux de la plateforme.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">MRR</span>
            <BarChart3 className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-3">— FCFA</p>
          <p className="text-xs text-slate-500 mt-1">Monthly Recurring Revenue</p>
        </Card>

        <Card className="border-l-4 border-l-blue-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">ARR</span>
            <BarChart3 className="w-5 h-5 text-blue-900 dark:text-blue-400" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-3">— FCFA</p>
          <p className="text-xs text-slate-500 mt-1">Annual Recurring Revenue</p>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Churn</span>
            <BarChart3 className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-3">— %</p>
          <p className="text-xs text-slate-500 mt-1">Taux de résiliation</p>
        </Card>
      </div>

      <Card className="p-12 text-center space-y-4">
        <FileSpreadsheet className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Rapports détaillés — Bientôt disponible</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Les rapports commerciaux avancés (MRR, ARR, churn, taux de renouvellement) seront
          disponibles dans une prochaine version.
        </p>
      </Card>
    </div>
  );
}
