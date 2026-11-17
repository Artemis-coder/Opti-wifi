import type { NextConfig } from "next";

// PostHog : les envois du navigateur passent par /ingest (même domaine) pour ne pas
// être bloqués par les bloqueurs de publicité. POSTHOG_HOST = https://us.i.posthog.com ou https://eu.i.posthog.com
const POSTHOG_HOST = process.env.POSTHOG_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
const POSTHOG_ASSETS = POSTHOG_HOST.replace('.i.posthog.com', '-assets.i.posthog.com');

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },

  // Ne pas annoncer « X-Powered-By: Next.js » (information utile à un attaquant)
  poweredByHeader: false,

  // Requis par le relais PostHog (/ingest/... avec barre oblique finale)
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: '/ingest/static/:path*', destination: `${POSTHOG_ASSETS}/static/:path*` },
      { source: '/ingest/array/:path*', destination: `${POSTHOG_ASSETS}/array/:path*` },
      { source: '/ingest/:path*', destination: `${POSTHOG_HOST}/:path*` },
    ];
  },

  // ── En-têtes de sécurité HTTP ────────────────────────────────────────────
  // Appliqués à toutes les routes pour protéger contre XSS, clickjacking,
  // sniffing de MIME, et limiter l'exposition des informations serveur.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Empêche le navigateur d'afficher la page dans une iframe (anti-clickjacking)
          { key: 'X-Frame-Options', value: 'DENY' },
          // Empêche le sniffing de type MIME
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Désactive la détection XSS du navigateur (remplacé par CSP)
          { key: 'X-XSS-Protection', value: '0' },
          // Contrôle les informations de référence envoyées
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Politique de permissions (désactiver les APIs non utilisées)
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
          // CSP minimale sans risque de casser les scripts (Next, PostHog) : interdit l'intégration
          // de la page ailleurs, les <base> détournés, les plugins et l'envoi de formulaires hors site.
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
          },
          // Force HTTPS (HSTS) — actif en production via Vercel
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
      // Mini App Telegram : Telegram Web (web.telegram.org) l'affiche dans une iframe. Les applications
      // Telegram mobiles et de bureau utilisent une vue web, sans iframe. Cette règle, placée après la
      // règle générale, remplace sa CSP sur ces seules pages (frame-ancestors prime sur X-Frame-Options).
      ...['/telegram/app', '/telegram/app/:path*'].map((source) => ({
        source,
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://web.telegram.org; base-uri 'self'; object-src 'none'; form-action 'self'",
          },
        ],
      })),
      // En-têtes spécifiques pour les API — ne pas cacher les réponses sensibles
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
          // Masquer la technologie utilisée côté serveur
          { key: 'X-Powered-By', value: '' },
        ],
      },
    ];
  },
};

export default nextConfig;
