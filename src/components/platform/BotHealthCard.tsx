'use client';

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleSlash, Link2, Stethoscope, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { confirmAction } from '@/components/ui/ConfirmDialog';
import type { HealthCheck, HealthStatus } from '@/lib/bot-health';

const ICONS: Record<HealthStatus, { icon: React.ElementType; className: string; label: string }> = {
  ok: { icon: CheckCircle2, className: 'text-emerald-600', label: 'OK' },
  warning: { icon: AlertTriangle, className: 'text-amber-500', label: 'Attention' },
  error: { icon: XCircle, className: 'text-red-500', label: 'Erreur' },
  missing: { icon: CircleSlash, className: 'text-slate-400', label: 'Non configuré' },
};

/**
 * Paramètres : santé du bot Telegram. Le serveur teste lui-même ses clés et ne renvoie que des
 * statuts ; « Réenregistrer le webhook » transmet le secret directement du serveur à Telegram.
 */
export function BotHealthCard() {
  const [checks, setChecks] = useState<HealthCheck[] | null>(null);
  const [env, setEnv] = useState('');
  const [running, setRunning] = useState(false);
  const [registering, setRegistering] = useState(false);

  const run = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/platform/bot-health', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setChecks(json.data);
      setEnv(json.environment);
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Diagnostic impossible');
    } finally {
      setRunning(false);
    }
  };

  const register = async () => {
    const ok = await confirmAction(
      'Le webhook du bot sera enregistré auprès de Telegram sur ce site, avec le secret configuré sur le serveur. Les messages envoyés au bot arriveront ici.',
      { title: 'Réenregistrer le webhook', confirmLabel: 'Réenregistrer', danger: false }
    );
    if (!ok) return;
    setRegistering(true);
    try {
      const res = await fetch('/api/platform/bot-health', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message);
      toast.success(json.message);
      await run();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Enregistrement impossible');
    } finally {
      setRegistering(false);
    }
  };

  const problems = checks?.filter((c) => c.status === 'error' || c.status === 'warning').length ?? 0;
  const canRegister = env === 'production' && checks?.some((c) => c.id === 'telegram' && c.status === 'ok') && checks?.some((c) => c.id === 'telegram_secret' && c.status === 'ok');

  return (
    <Card className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 shrink-0 rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center">
          <Stethoscope className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Santé du bot Telegram</h2>
          <p className="text-xs text-slate-500">
            Le serveur vérifie lui-même ses clés (Telegram, IA, Vercel). Seuls les résultats s&apos;affichent : aucune clé n&apos;est montrée.
          </p>
        </div>
      </div>

      {checks && (
        <>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {problems === 0 ? 'Tout fonctionne' : `${problems} point${problems > 1 ? 's' : ''} à corriger`}
            {env && <span className="font-normal text-slate-500"> · environnement {env}</span>}
          </p>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
            {checks.map((c) => {
              const s = ICONS[c.status];
              const Icon = s.icon;
              return (
                <li key={c.id} className="flex items-start gap-3 px-3.5 py-3">
                  <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${s.className}`} aria-label={s.label} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{c.label}</p>
                    <p className="text-xs text-slate-500 break-words">{c.message}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <Button icon={Stethoscope} onClick={run} isLoading={running} className="w-full sm:w-auto font-semibold">
          {checks ? 'Relancer le diagnostic' : 'Lancer le diagnostic'}
        </Button>
        {canRegister && (
          <Button variant="outline" icon={Link2} onClick={register} isLoading={registering} className="w-full sm:w-auto">
            Réenregistrer le webhook
          </Button>
        )}
      </div>
    </Card>
  );
}
