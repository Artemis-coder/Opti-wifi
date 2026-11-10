'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, Globe, Laptop, MapPin, Monitor, Smartphone, Tablet } from 'lucide-react';
import { countryFlag, countryName } from '@/lib/countries';

interface LoginEntry {
  at: string;
  ip: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
}

const DEVICE: Record<string, { label: string; icon: React.ElementType }> = {
  mobile: { label: 'Téléphone', icon: Smartphone },
  tablet: { label: 'Tablette', icon: Tablet },
  desktop: { label: 'Ordinateur', icon: Laptop },
};

const when = (d: string) =>
  new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(
    new Date(d)
  );

/**
 * Paramètres > Profil > Rôle et activité : dernière connexion connue du compte, avec
 * l'appareil, l'heure, le lieu, les coordonnées et l'adresse IP (historique des connexions).
 */
export function LastLoginField() {
  const [state, setState] = useState<{ last: LoginEntry | null; at: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/account/logins', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json) => {
        const last = (json.data?.[0] as LoginEntry | undefined) ?? null;
        if (!cancelled) setState({ last, at: last?.at ?? json.lastSignInAt ?? null });
      })
      .catch(() => !cancelled && setState({ last: null, at: null }));
    return () => {
      cancelled = true;
    };
  }, []);

  const e = state?.last;
  const device = e ? DEVICE[e.deviceType || ''] ?? { label: 'Appareil', icon: Monitor } : null;
  const place = e ? [e.city, e.country ? countryName(e.country) : null].filter(Boolean).join(', ') : '';
  const hasCoords = !!e && e.latitude !== null && e.longitude !== null;

  return (
    <div className="col-span-2 min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Dernière connexion</p>
      {!state ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : !state.at ? (
        <p className="text-sm font-medium text-slate-900 dark:text-white">Aucune connexion enregistrée</p>
      ) : (
        <div className="mt-1 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5 space-y-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Clock className="w-4 h-4 shrink-0 text-slate-500" />
            <span className="first-letter:uppercase">{when(state.at)}</span>
          </p>
          {e && device && (
            <>
              <p className="text-sm text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <device.icon className="w-4 h-4 shrink-0 text-slate-500" />
                {device.label}
                {(e.browser || e.os) && <span className="text-slate-500">· {[e.browser, e.os].filter(Boolean).join(' sur ')}</span>}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {place ? `${e.country ? `${countryFlag(e.country)} ` : ''}${place}` : 'Lieu inconnu'}
                </span>
                {hasCoords && (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${e.latitude}&mlon=${e.longitude}#map=11/${e.latitude}/${e.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tabular-nums text-brand-600 hover:text-brand-700 underline"
                    title="Voir sur la carte (position approximative)"
                  >
                    {e.latitude!.toFixed(4)}, {e.longitude!.toFixed(4)}
                  </a>
                )}
                {e.ip && (
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Globe className="w-3.5 h-3.5 shrink-0" /> IP {e.ip}
                  </span>
                )}
              </p>
            </>
          )}
          <Link href="/settings?tab=security" className="inline-block text-xs font-semibold text-brand-600 hover:text-brand-700">
            Voir toutes mes connexions
          </Link>
        </div>
      )}
    </div>
  );
}
