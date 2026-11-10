// ============================================================
// OPTIWIFI - Appareil d'après le User-Agent (serveur et navigateur, sans dépendance).
// Sert à l'historique des connexions (lib/login-history.ts).
// ============================================================

export interface DeviceInfo {
  deviceType: 'mobile' | 'tablet' | 'desktop';
  browser: string | null;
  os: string | null;
}

/** Appareil d'après le User-Agent (sans dépendance : les cas courants suffisent). */
export function parseUserAgent(ua: string | null): DeviceInfo {
  const s = ua || '';
  const isTablet = /iPad|Tablet|PlayBook|Silk/i.test(s) || (/Android/i.test(s) && !/Mobile/i.test(s));
  const isMobile = !isTablet && /Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(s);

  let os: string | null = null;
  if (/iPhone|iPad|iPod/i.test(s)) os = `iOS ${(s.match(/OS (\d+)[_.]?(\d+)?/) || []).slice(1, 3).filter(Boolean).join('.')}`.trim();
  else if (/Android/i.test(s)) os = `Android ${s.match(/Android (\d+(\.\d+)?)/)?.[1] ?? ''}`.trim();
  else if (/Windows NT/i.test(s)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(s)) os = 'macOS';
  else if (/CrOS/i.test(s)) os = 'ChromeOS';
  else if (/Linux/i.test(s)) os = 'Linux';

  let browser: string | null = null;
  if (/Edg\//.test(s)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(s)) browser = 'Opera';
  else if (/SamsungBrowser/.test(s)) browser = 'Samsung Internet';
  else if (/Firefox|FxiOS/.test(s)) browser = 'Firefox';
  else if (/Chrome|CriOS/.test(s)) browser = 'Chrome';
  else if (/Safari/.test(s)) browser = 'Safari';

  return { deviceType: isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop', browser, os };
}
