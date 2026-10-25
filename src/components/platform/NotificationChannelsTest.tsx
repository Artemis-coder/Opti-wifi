'use client';

import React, { useEffect, useState } from 'react';
import { BellRing, CheckCircle2, Send, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getPushState, subscribeToPush, type PushState } from '@/lib/push-client';

interface TestResult {
  inApp: boolean;
  push: { configured: boolean; subscriptions: number; sent: number; failed: number };
  telegram: { ok: boolean; error?: string; bot?: string; botError?: string };
}

const PUSH_STATE_LABEL: Record<PushState, string> = {
  subscribed: 'activé sur cet appareil',
  default: 'pas encore activé sur cet appareil',
  denied: 'bloqué dans les réglages du navigateur',
  'ios-needs-install': "sur iPhone : ajoutez d'abord le site à l'écran d'accueil",
  unsupported: 'non pris en charge par ce navigateur',
};

function Line({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />}
      <span>
        <span className="font-semibold text-slate-900 dark:text-white">{label}</span>
        <span className="text-slate-500"> — {detail}</span>
      </span>
    </li>
  );
}

/** Carte des paramètres : état du push sur cet appareil et test des trois canaux. */
export function NotificationChannelsTest() {
  const [pushState, setPushState] = useState<PushState>('unsupported');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPushState().then(setPushState).catch(() => setPushState('unsupported'));
  }, []);

  async function runTest() {
    setTesting(true);
    setError(null);
    try {
      const res = await fetch('/api/platform/notifications/test', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setTesting(false);
    }
  }

  const push = result?.push;
  const tg = result?.telegram;

  return (
    <Card className="space-y-5">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <BellRing className="w-5 h-5 text-brand-600" />
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">Canaux de notification</p>
          <p className="text-xs text-slate-500">Cloche, notifications push et Telegram : envoyez-vous un test.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Push : <span className="font-semibold">{PUSH_STATE_LABEL[pushState]}</span>
        </p>
        {pushState === 'default' && (
          <Button variant="outline" size="sm" onClick={async () => setPushState(await subscribeToPush())}>
            Activer sur cet appareil
          </Button>
        )}
      </div>

      <Button onClick={runTest} isLoading={testing} className="gap-2">
        <Send className="w-4 h-4" /> Envoyer une notification de test
      </Button>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && push && tg && (
        <ul className="space-y-2">
          <Line ok={result.inApp} label="Cloche" detail={result.inApp ? 'notification créée' : 'échec'} />
          <Line
            ok={push.configured && push.sent > 0 && push.failed === 0}
            label="Push"
            detail={
              !push.configured
                ? 'clés VAPID absentes sur le serveur'
                : push.subscriptions === 0
                  ? 'aucun appareil abonné : activez le push ci-dessus'
                  : `${push.sent}/${push.subscriptions} appareil(s) atteint(s)${push.failed ? `, ${push.failed} en échec` : ''}`
            }
          />
          <Line
            ok={tg.ok}
            label="Telegram"
            detail={tg.ok ? `message envoyé${tg.bot ? ` par @${tg.bot}` : ''}` : tg.botError || tg.error || 'échec'}
          />
        </ul>
      )}
    </Card>
  );
}
