'use client';

import React from 'react';
import { Settings, Globe, Shield, Bell } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Paramètres Système</h1>
        <p className="text-xs text-slate-500">Préférences d'affichage, devise et sécurité de l'application.</p>
      </div>

      <Card className="space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Devise Principale</p>
              <p className="text-xs text-slate-500">Franc CFA (XOF / FCFA)</p>
            </div>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-amber-500/10 text-amber-600 rounded-lg">FCFA (Fixe)</span>
        </div>

        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-blue-900 dark:text-blue-400" />
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Sécurité RLS Supabase</p>
              <p className="text-xs text-slate-500">Isolation stricte des données par rôle</p>
            </div>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-lg">Activé ✓</span>
        </div>
      </Card>
    </div>
  );
}
