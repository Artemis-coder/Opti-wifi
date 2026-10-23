'use client';

import React from 'react';
import { CreditCard, Calendar, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export default function SubscriptionPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-brand-600 dark:text-brand-400" />
          <span>Mon Abonnement</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Suivi de votre abonnement et de sa validité.
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Abonnement Actif</h2>
            <p className="text-sm text-slate-500 mt-1">Votre espace est actif</p>
          </div>
          <Badge variant="success" className="gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Actif
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Date de début</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">-</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Jours restants</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">-</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
