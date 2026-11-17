'use client';

import { useSyncExternalStore } from 'react';

// Palette catégorielle validée (ordre fixe, contrôle daltonisme OK en clair et en sombre)
export const CHART_PALETTE = {
  light: { s1: '#2a78d6', s2: '#eb6834', s3: '#1baf7a', s4: '#eda100', danger: '#e5484d', surface: '#ffffff', grid: '#e4e4e7', text: '#71717a', track: '#f4f4f5' },
  dark: { s1: '#3987e5', s2: '#d95926', s3: '#199e70', s4: '#c98500', danger: '#e5484d', surface: '#18181b', grid: '#27272a', text: '#a1a1aa', track: '#232327' },
};

export type ChartColors = (typeof CHART_PALETTE)['light'];

function subscribeTheme(cb: () => void) {
  // Thème affiché : data-theme sur <html> (système dans l'application, Telegram dans la Mini App)
  const observer = new MutationObserver(cb);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', cb);
  return () => {
    observer.disconnect();
    mq.removeEventListener('change', cb);
  };
}

function isDark(): boolean {
  const theme = document.documentElement.dataset.theme;
  if (theme) return theme === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Mode sombre réellement affiché (suit data-theme, sinon le système). */
export function useDarkMode(): boolean {
  return useSyncExternalStore(subscribeTheme, isDark, () => false);
}

export function useChartColors(): ChartColors {
  return CHART_PALETTE[useDarkMode() ? 'dark' : 'light'];
}
