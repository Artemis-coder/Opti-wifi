'use client';

import React from 'react';
import { Activity, CloudUpload } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { formatBytes } from '@/hooks/useNetworkMetrics';
import { TONE_SURFACE } from '@/hooks/useNetworkPanel';
import { cn } from '@/lib/utils/cn';

export interface NetworkPanelState {
  tone: 'ok' | 'warn' | 'bad' | 'busy';
  label: string;
  icon: typeof Activity;
  showLabel: boolean;
  isSyncing: boolean;
  pendingCount: number;
  connection: {
    downlink: number | null;
    rtt: number | null;
    effectiveType: string | null;
    type: string | null;
    saveData: boolean;
    isSupported: boolean;
  };
  traffic: { sent: number; received: number };
  detailsOpen: boolean;
  setDetailsOpen: (open: boolean) => void;
  handleSync: () => Promise<void>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-[13px] text-slate-500">{label}</span>
      <span className="text-[13px] font-semibold text-slate-900 dark:text-white text-right">
        {value}
      </span>
    </div>
  );
}

/** Material 3 modal bottom sheet with the full network diagnostics. */
export function NetworkDetailsSheet({ panel }: { panel: NetworkPanelState }) {
  const { connection, traffic, pendingCount, isSyncing, handleSync, setDetailsOpen } = panel;
  const StatusIcon = panel.icon;

  return (
    <Modal
      isOpen={panel.detailsOpen}
      onClose={() => setDetailsOpen(false)}
      title="État de la connexion"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-3">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            TONE_SURFACE[panel.tone]
          )}
        >
          <StatusIcon className={cn('w-5 h-5', panel.label === 'Vérification…' && 'animate-spin')} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{panel.label}</p>
          <p className="text-[11px] text-slate-500">
            {connection.type
              ? `Type : ${connection.type}${connection.effectiveType ? ` · ${connection.effectiveType.toUpperCase()}` : ''}`
              : 'Type de connexion non exposé'}
          </p>
        </div>
      </div>

      <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 px-4">
        <Row
          label="Débit descendant estimé"
          value={
            connection.downlink != null
              ? `${connection.downlink.toFixed(1)} Mbit/s`
              : 'Non disponible'
          }
        />
        <Row
          label="Latence"
          value={connection.rtt != null ? `${Math.round(connection.rtt)} ms` : 'Non disponible'}
        />
        <Row label="Données reçues" value={formatBytes(traffic.received)} />
        <Row label="Données envoyées" value={formatBytes(traffic.sent)} />
        <Row label="Actions hors ligne" value={String(pendingCount)} />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        Le débit et la latence sont des estimations fournies par le téléphone
        (Network Information API). Les volumes de données sont mesurés sur les
        requêtes et réponses échangées par l&apos;application depuis son
        ouverture.
      </p>

      {pendingCount > 0 && (
        <button
          type="button"
          onClick={handleSync}
          disabled={isSyncing}
          className="md-ripple mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 text-sm font-semibold text-slate-950 disabled:opacity-60"
        >
          <CloudUpload className={cn('w-4 h-4', isSyncing && 'animate-bounce')} />
          {isSyncing ? 'Synchronisation…' : `Synchroniser ${pendingCount} action(s)`}
        </button>
      )}

      <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
        <Activity className="mt-0.5 w-4 h-4 shrink-0 text-slate-400" />
        <p className="text-[11px] leading-relaxed text-slate-500">
          Android n&apos;expose pas de compteur d&apos;octets temps réel à une
          application WebView : ces volumes couvrent uniquement le trafic de
          l&apos;application, pas l&apos;usage du téléphone dans son ensemble.
        </p>
      </div>
    </Modal>
  );
}
