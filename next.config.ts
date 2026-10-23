import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
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
          // Force HTTPS (HSTS) — actif en production via Vercel
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
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
