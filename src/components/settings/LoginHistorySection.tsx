'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Clock, Globe, History, Laptop, Loader2, MapPin, Monitor, Smartphone, Tablet } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { countryFlag, countryName } from '@/lib/countries';
import { parseUserAgent } from '@/lib/user-agent';
import { cn } from '@/lib/utils/cn';

interface LoginEntry {
  id: string;
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
  new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(
    new Date(d)
  );

function place(e: LoginEntry): string | null {
  const parts = [e.city, // Région : affichée seulement si c'est un nom (Vercel donne souvent un code, ex. « AB »)
    e.region && e.region !== e.city && e.region.length > 3 ? e.region : null, e.country ? countryName(e.country) : null];
  const text = parts.filter(Boolean).join(', ');
  return text ? `${e.country ? `${countryFlag(e.country)} ` : ''}${text}` : null;
}

/**
 * Paramètres > Sécurité : dernières connexions du compte (appareil, adresse IP, lieu et
 * coordonnées approximatifs), pour repérer une connexion inhabituelle.
 */
export function LoginHistorySection() {
  const [entries, setEntries] = useState<LoginEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/account/logins', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json) => !cancelled && setEntries(json.data || []))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // « Cet appareil » : la connexion la plus récente faite avec le même navigateur et le même système
  const currentId = useMemo(() => {
    if (!entries?.length || typeof navigator === 'undefined') return null;
    const me = parseUserAgent(navigator.userAgent);
    return entries.find((e) => e.browser === me.browser && e.os?.split(' ')[0] === me.os?.split(' ')[0] && e.deviceType === me.deviceType)?.id ?? null;
  }, [entries]);

  const list = showAll ? entries ?? [] : (entries ?? []).slice(0, 8);
  const last = entries?.[0];

  return (
    <Card className="space-y-5">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <History className="w-5 h-5 shrink-0 text-brand-600" />
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">Connexions et appareils</p>
          <p className="text-xs text-slate-500">
            Chaque connexion à votre compte : appareil, adresse IP et lieu approximatif. Une connexion que vous ne reconnaissez pas ?
            Changez votre mot de passe ci-dessus.
          </p>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-slate-500">Historique indisponible pour le moment (connexion internet nécessaire).</p>
      ) : !entries ? (
        <p className="text-sm text-slate-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
        </p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-500">
          Aucune connexion enregistrée pour le moment : les prochaines connexions apparaîtront ici.
        </p>
      ) : (
        <>
          {last && (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <span className="text-slate-500">Dernière connexion</span>
              <span className="font-semibold text-slate-900 dark:text-white">{when(last.at)}</span>
              {place(last) && <span className="text-slate-600 dark:text-slate-300">{place(last)}</span>}
            </div>
          )}

          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.map((e) => {
              const device = DEVICE[e.deviceType || ''] ?? { label: 'Appareil', icon: Monitor };
              const where = place(e);
              const hasCoords = e.latitude !== null && e.longitude !== null;
              return (
                <li key={e.id} className="py-3 flex gap-3">
                  <span
                    className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                      e.id === currentId ? 'bg-brand-500/10 text-brand-600' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                    )}
                  >
                    <device.icon className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
                      {[e.browser, e.os].filter(Boolean).join(' sur ') || device.label}
                      <span className="text-xs font-medium text-slate-500">· {device.label}</span>
                      {e.id === currentId && <Badge variant="success">Cet appareil</Badge>}
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 shrink-0" /> {when(e.at)}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" /> {where ?? 'Lieu inconnu'}
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
                          <Globe className="w-3 h-3 shrink-0" /> IP {e.ip}
                        </span>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-[11px] text-slate-500">
              Lieu déduit de l’adresse IP (précision : la ville). Historique conservé 180 jours.
            </p>
            {entries.length > 8 && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                {showAll ? 'Afficher moins' : `Tout afficher (${entries.length})`}
              </button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
