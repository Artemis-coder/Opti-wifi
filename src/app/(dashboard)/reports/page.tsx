'use client';

import React from 'react';
import { FileSpreadsheet, Download, FileText, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function ReportsPage() {
  const exportCSV = (type: string) => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    if (type === 'sales') {
      csvContent += 'Date,Point de Vente,Ticket,Quantite,Montant FCFA\n2026-08-29,POS Cocody,Pass 24h,50,50000\n';
    } else {
      csvContent += 'Date,Point de Vente,Collecteur,Attendu FCFA,Collecte FCFA,Ecart FCFA\n2026-08-29,POS Yopougon,Diallo Oumar,650000,620000,-30000\n';
    }
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `optiwifi_export_${type}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Rapports & Exports CSV</h1>
        <p className="text-xs text-slate-500">Téléchargez les données comptables et l'historique d'exploitation.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="space-y-4 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Rapport des Ventes par POS</h3>
              <p className="text-xs text-slate-500">Détail journalier des tickets vendus par point de distribution.</p>
            </div>
          </div>
          <Button onClick={() => exportCSV('sales')} variant="secondary" className="w-full gap-2 font-bold">
            <Download className="w-4 h-4" /> Exporter en CSV (.csv)
          </Button>
        </Card>

        <Card className="space-y-4 border-l-4 border-l-blue-900">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-900/10 text-blue-900 dark:text-amber-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Rapport des Encaissements & Écarts</h3>
              <p className="text-xs text-slate-500">Historique des levées de fond et suivi des anomalies de caisse.</p>
            </div>
          </div>
          <Button onClick={() => exportCSV('collections')} className="w-full gap-2 font-bold">
            <Download className="w-4 h-4" /> Exporter en CSV (.csv)
          </Button>
        </Card>
      </div>
    </div>
  );
}
