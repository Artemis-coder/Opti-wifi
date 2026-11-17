'use client';

/**
 * Cadre commun des Mini Apps Telegram (Business, IA, Paiement, Système) : script Telegram, thème,
 * en-tête, sélecteur d'application, barre d'onglets et appels API signés (initData).
 */
import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { Card, Spinner } from '@heroui/react';
import { AlertTriangle, BarChart3, Bot, CreditCard, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';

// ── Telegram WebApp ──────────────────────────────────────────────────────────

interface TelegramWebApp {
  initData: string;
  colorScheme: 'light' | 'dark';
  ready: () => void;
  expand: () => void;
  openLink: (url: string) => void;
  onEvent: (event: 'themeChanged', cb: () => void) => void;
  HapticFeedback?: { notificationOccurred: (type: 'success' | 'error' | 'warning') => void };
}

export function telegram(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp ?? null;
}

function applyTheme(tg: TelegramWebApp) {
  const dark = tg.colorScheme === 'dark';
  const root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  root.classList.toggle('dark', dark);
  root.classList.toggle('light', !dark);
}

export function haptic(type: 'success' | 'error' | 'warning') {
  telegram()?.HapticFeedback?.notificationOccurred(type);
}

export class MiniAppError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Appel à l'API d'une Mini App, signé avec les données Telegram. */
export async function miniApi<T>(app: MiniAppId, path = '', init?: RequestInit): Promise<T> {
  const base = app === 'business' ? '/api/telegram/miniapp' : `/api/telegram/miniapp/${APPS[app].api}`;
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': telegram()?.initData || '', ...init?.headers },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new MiniAppError(data.error || 'Erreur inattendue.', res.status);
  return data as T;
}

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.optiwifi.site').replace(/\/$/, '');

/** Ouvre une page du back-office (ou un lien externe) dans le navigateur. */
export function openExternal(pathOrUrl: string) {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${SITE}${pathOrUrl}`;
  const tg = telegram();
  if (tg) tg.openLink(url);
  else window.open(url, '_blank', 'noopener');
}

// ── Applications ─────────────────────────────────────────────────────────────

export type MiniAppId = 'business' | 'ia' | 'paiements' | 'systeme';

export const APPS: Record<MiniAppId, { name: string; short: string; href: string; api: string; icon: React.ElementType }> = {
  business: { name: 'Business OptiSpace', short: 'Business', href: '/telegram/app', api: '', icon: BarChart3 },
  ia: { name: 'IA — Claude Code', short: 'IA', href: '/telegram/app/ia', api: 'ia', icon: Bot },
  paiements: { name: 'Paiement en ligne', short: 'Paiement', href: '/telegram/app/paiements', api: 'paiements', icon: CreditCard },
  systeme: { name: 'Système', short: 'Système', href: '/telegram/app/systeme', api: 'systeme', icon: ShieldCheck },
};

export interface MiniAppTab<T extends string> {
  id: T;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

interface ShellProps<T extends string> {
  app: MiniAppId;
  tabs: MiniAppTab<T>[];
  tab: T;
  onTab: (tab: T) => void;
  onRefresh?: () => Promise<void> | void;
  /** Rendu une fois le script Telegram prêt */
  children: React.ReactNode;
}

export function MiniAppShell<T extends string>({ app, tabs, tab, onTab, onRefresh, children }: ShellProps<T>) {
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const init = useCallback(() => {
    const tg = telegram();
    if (tg) {
      tg.ready();
      tg.expand();
      applyTheme(tg);
      tg.onEvent('themeChanged', () => applyTheme(tg));
    }
    setReady(true);
  }, []);

  const refresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const current = tabs.find((t) => t.id === tab);
  const AppIcon = APPS[app].icon;

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" onReady={init} onError={() => setReady(true)} />
      <div className="min-h-dvh bg-background pb-24">
        <header className="sticky top-0 z-30 border-b border-separator bg-surface/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 pt-3 pb-2">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground">
                <AppIcon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs text-muted">{APPS[app].name}</p>
                <h1 className="truncate text-base font-semibold text-foreground">{current?.label ?? APPS[app].short}</h1>
              </div>
            </div>
            {onRefresh && (
              <Button variant="ghost" size="sm" isIconOnly icon={RefreshCw} aria-label="Actualiser" isLoading={refreshing} onClick={refresh} />
            )}
          </div>
          {/* Passage d'une Mini App à l'autre (la session Telegram est conservée) */}
          <nav aria-label="Applications OptiSpace" className="mx-auto flex max-w-xl gap-1.5 overflow-x-auto px-4 pb-2.5">
            {(Object.keys(APPS) as MiniAppId[]).map((id) => {
              const Icon = APPS[id].icon;
              const active = id === app;
              return (
                <Link
                  key={id}
                  href={APPS[id].href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    active ? 'bg-accent text-accent-foreground' : 'bg-default text-muted hover:text-foreground'
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {APPS[id].short}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="mx-auto flex max-w-xl flex-col gap-4 p-4">{ready ? children : <Loading />}</main>

        <nav aria-label="Onglets" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-separator bg-surface/95 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-xl items-stretch gap-1 px-2">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onTab(t.id)}
                  className={cn(
                    'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus',
                    active ? 'font-medium text-accent' : 'text-muted'
                  )}
                >
                  <span className={cn('relative flex h-7 w-12 items-center justify-center rounded-full transition-colors', active && 'bg-accent-soft')}>
                    <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
                    {!!t.badge && (
                      <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-danger px-1 text-[10px] font-semibold leading-4 text-danger-foreground">
                        {t.badge}
                      </span>
                    )}
                  </span>
                  <span className="w-full truncate px-0.5 text-center">{t.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </>
  );
}

// ── Éléments communs ─────────────────────────────────────────────────────────

export function Loading() {
  return (
    <div className="flex justify-center py-16">
      <Spinner />
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <h2 className="text-sm font-semibold text-foreground">{children}</h2>
      {action}
    </div>
  );
}

export function Empty({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <Card>
      <Card.Content className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted">
        <Icon className="size-8 opacity-60" aria-hidden />
        {text}
      </Card.Content>
    </Card>
  );
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card>
      <Card.Content className="flex flex-col items-center gap-3 py-8 text-center">
        <AlertTriangle className="size-8 text-warning" aria-hidden />
        <p className="text-sm text-foreground">{message}</p>
        {onRetry && (
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry}>
            Réessayer
          </Button>
        )}
      </Card.Content>
    </Card>
  );
}

export function ExternalLinkButton({ path, label = 'Back-office' }: { path: string; label?: string }) {
  return (
    <button type="button" onClick={() => openExternal(path)} className="flex items-center gap-1 text-xs font-medium text-accent">
      {label}
      <ExternalLink className="size-3.5" aria-hidden />
    </button>
  );
}

/** Liste de lignes dans une carte (séparateurs HeroUI). */
export function ListCard({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <Card.Content className="divide-y divide-separator p-0">{children}</Card.Content>
    </Card>
  );
}

export function ListRow({
  title,
  subtitle,
  end,
  onPress,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  end?: React.ReactNode;
  onPress?: () => void;
}) {
  const body = (
    <>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
      </div>
      {end}
    </>
  );
  const className = 'flex w-full items-center justify-between gap-3 px-4 py-3 text-left';
  return onPress ? (
    <button type="button" onClick={onPress} className={className}>
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
}

/**
 * Charge les données d'un onglet : renvoie [données, erreur, recharger].
 * Le chargement se relance quand `key` change.
 */
export function useMiniAppData<D>(loader: () => Promise<D>, key: string): [D | null, string | null, () => Promise<void>] {
  const [state, setState] = useState<{ key: string; data: D | null; error: string | null }>({ key: '', data: null, error: null });

  const reload = useCallback(async () => {
    try {
      const data = await loader();
      setState({ key, data, error: null });
    } catch (err) {
      setState((s) => ({ ...s, key, error: err instanceof Error ? err.message : 'Erreur inattendue.' }));
    }
  }, [loader, key]);

  React.useEffect(() => {
    let cancelled = false;
    loader()
      .then((data) => {
        if (!cancelled) setState({ key, data, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState((s) => ({ ...s, key, error: err instanceof Error ? err.message : 'Erreur inattendue.' }));
      });
    return () => {
      cancelled = true;
    };
  }, [loader, key]);

  return [state.key === key ? state.data : null, state.key === key ? state.error : null, reload];
}
