'use client';

import React, { useEffect, useState } from 'react';
import { Bot, CheckCircle2, Eye, EyeOff, KeyRound, Link2, Loader2, MessageSquare, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { confirmAction } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils/cn';

interface Source {
  key: 'TELEGRAM_BOT_TOKEN' | 'TELEGRAM_WEBHOOK_SECRET' | 'TELEGRAM_CHAT_ID';
  configured: boolean;
  source: 'interface' | 'vercel' | null;
  unreadable: boolean;
}

interface ConfigState {
  environment: string;
  sources: Source[];
  bot: string | null;
  webhook: { host: string | null; expected: string; connectedHere: boolean };
  canConnect: boolean;
}

const SOURCE_LABEL = { interface: 'Saisi ici', vercel: 'Variable Vercel' } as const;

function SourceBadge({ s, onReset, resetting }: { s?: Source; onReset: () => void; resetting: boolean }) {
  if (!s) return null;
  if (s.unreadable) return <Badge variant="danger">À ressaisir</Badge>;
  if (!s.configured) return <Badge variant="neutral">Non configuré</Badge>;
  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <Badge variant={s.source === 'interface' ? 'success' : 'info'}>{SOURCE_LABEL[s.source!]}</Badge>
      {s.source === 'interface' && (
        <button
          type="button"
          onClick={onReset}
          disabled={resetting}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline-offset-2 hover:underline disabled:opacity-50"
        >
          Revenir à Vercel
        </button>
      )}
    </span>
  );
}

/**
 * Paramètres → Bot Telegram : saisie du jeton, du secret du webhook et du chat autorisé, puis
 * branchement du webhook. Les valeurs sont chiffrées côté serveur et ne sont jamais réaffichées.
 */
export function TelegramBotConfigCard() {
  const [state, setState] = useState<ConfigState | null>(null);
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [secretMode, setSecretMode] = useState<'keep' | 'generate' | 'manual'>('keep');
  const [secret, setSecret] = useState('');
  const [chatId, setChatId] = useState('');
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const apply = (json: { data?: ConfigState }) => json.data && setState(json.data);

  useEffect(() => {
    fetch('/api/platform/telegram-config', { cache: 'no-store' })
      .then((res) => res.json())
      .then(apply)
      .catch(() => toast.error('Configuration du bot indisponible'));
  }, []);

  const src = (key: Source['key']) => state?.sources.find((s) => s.key === key);
  const secretConfigured = !!src('TELEGRAM_WEBHOOK_SECRET')?.configured;

  const save = async (connectOnly = false) => {
    const body: Record<string, unknown> = {};
    if (!connectOnly) {
      if (token.trim()) body.token = token.trim();
      if (chatId.trim()) body.chatId = chatId.trim();
      if (secretMode === 'generate') body.secret = 'generate';
      if (secretMode === 'manual' && secret.trim()) body.secret = secret.trim();
      if (Object.keys(body).length === 0) {
        toast.info('Aucune modification à enregistrer');
        return;
      }
    } else {
      body.connect = true;
    }
    const connects = connectOnly || !!body.token || !!body.secret;
    if (connects) {
      const target = state?.webhook.expected.split('/')[0];
      const ok = await confirmAction(
        `Le webhook sera branché sur ${target} : les messages envoyés au bot ${state?.bot || ''} arriveront sur ce site.${
          state?.environment !== 'production' ? '\n\nCe bot ne doit pas être celui de production.' : ''
        }`,
        { title: 'Brancher le webhook', confirmLabel: 'Brancher', danger: false }
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/platform/telegram-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      apply(json);
      setToken('');
      setSecret('');
      setChatId('');
      setSecretMode('keep');
      if (json.webhook && !json.webhook.ok) toast.error(json.webhook.message);
      else toast.success(json.webhook ? `Enregistré · ${json.webhook.message}` : 'Configuration enregistrée');
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const reset = async (key: 'token' | 'secret' | 'chat') => {
    const ok = await confirmAction('La valeur saisie ici sera supprimée et la variable Vercel reprendra la main.', {
      title: 'Revenir à la variable Vercel',
      confirmLabel: 'Revenir à Vercel',
    });
    if (!ok) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/platform/telegram-config?key=${key}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      apply(json);
      toast.success('Variable Vercel rétablie');
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Échec');
    } finally {
      setResetting(false);
    }
  };

  if (!state) {
    return (
      <Card className="py-10 flex justify-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </Card>
    );
  }

  return (
    <Card className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 shrink-0 rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center">
          <Bot className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Configuration du bot</h2>
          <p className="text-xs text-slate-500">
            Les valeurs saisies sont chiffrées sur le serveur et ne sont jamais réaffichées. Elles remplacent les variables Vercel.
          </p>
        </div>
      </div>

      {/* État actuel */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 grid gap-2 text-sm">
        <p className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-slate-400" />
          <span className="text-slate-500">Bot :</span>
          <span className="font-semibold text-slate-900 dark:text-white">{state.bot || 'aucun bot valide'}</span>
        </p>
        <p className="flex items-start gap-2">
          <Link2 className="w-4 h-4 mt-0.5 text-slate-400" />
          <span className="text-slate-500">Webhook :</span>
          <span className={cn('font-semibold break-all', state.webhook.connectedHere ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-white')}>
            {state.webhook.host ? (state.webhook.connectedHere ? `branché sur ce site (${state.webhook.host})` : state.webhook.host) : 'non branché'}
          </span>
          {state.webhook.connectedHere && <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />}
        </p>
        <p className="text-xs text-slate-500">Environnement : {state.environment}</p>
      </div>

      {/* Jeton */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5" /> Jeton du bot
          </p>
          <SourceBadge s={src('TELEGRAM_BOT_TOKEN')} onReset={() => reset('token')} resetting={resetting} />
        </div>
        <Input
          type={showToken ? 'text' : 'password'}
          autoComplete="off"
          spellCheck={false}
          placeholder={src('TELEGRAM_BOT_TOKEN')?.configured ? 'Laisser vide pour garder le jeton actuel' : '123456789:ABCdef…'}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          helperText="Donné par @BotFather dans Telegram (/newbot ou /token). Vérifié auprès de Telegram avant l'enregistrement."
          rightElement={
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              aria-label={showToken ? 'Masquer le jeton' : 'Afficher le jeton'}
              className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-700"
            >
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          }
        />
      </div>

      {/* Secret */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Secret du webhook
          </p>
          <SourceBadge s={src('TELEGRAM_WEBHOOK_SECRET')} onReset={() => reset('secret')} resetting={resetting} />
        </div>
        <div role="radiogroup" aria-label="Secret du webhook" className="grid gap-2 sm:grid-cols-3">
          {(
            [
              { value: 'keep', label: secretConfigured ? 'Garder l’actuel' : 'Aucun (généré avec le jeton)' },
              { value: 'generate', label: 'Générer un nouveau secret' },
              { value: 'manual', label: 'Saisir un secret' },
            ] as const
          ).map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={secretMode === o.value}
              onClick={() => setSecretMode(o.value)}
              className={cn(
                'min-h-11 px-3 py-2 rounded-xl border text-sm font-medium text-left transition',
                secretMode === o.value
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30 text-brand-800 dark:text-brand-200'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        {secretMode === 'manual' && (
          <Input
            type="password"
            autoComplete="off"
            placeholder="32 caractères minimum : lettres, chiffres, « _ » ou « - »"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
        )}
        <p className="text-xs text-slate-500">
          Mot de passe que Telegram présente au site à chaque message. Le générer suffit : vous n&apos;avez jamais besoin de le voir.
          Le webhook est rebranché automatiquement quand il change.
        </p>
      </div>

      {/* Chat autorisé */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" /> Chat autorisé
          </p>
          <SourceBadge s={src('TELEGRAM_CHAT_ID')} onReset={() => reset('chat')} resetting={resetting} />
        </div>
        <Input
          inputMode="numeric"
          placeholder={src('TELEGRAM_CHAT_ID')?.configured ? 'Laisser vide pour garder l’actuel' : 'ex : 123456789'}
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          helperText="Votre identifiant Telegram : envoyez un message à @userinfobot pour l'obtenir. Seul ce chat peut utiliser le bot."
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <Button icon={Save} onClick={() => save(false)} isLoading={saving} className="w-full sm:w-auto font-semibold">
          Enregistrer et brancher le webhook
        </Button>
        {state.canConnect && src('TELEGRAM_BOT_TOKEN')?.configured && secretConfigured && (
          <Button variant="outline" icon={RotateCcw} onClick={() => save(true)} disabled={saving} className="w-full sm:w-auto">
            Rebrancher le webhook
          </Button>
        )}
      </div>
      {!state.canConnect && state.environment !== 'production' && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Hors production, le webhook ne peut être branché qu&apos;avec un bot de test saisi ici (jamais le bot de production).
        </p>
      )}
    </Card>
  );
}
