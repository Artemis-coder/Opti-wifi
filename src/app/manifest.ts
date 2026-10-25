import type { MetadataRoute } from 'next';

// Permet d'installer OptiSpace (écran d'accueil). Sur iPhone, c'est requis pour recevoir les notifications push.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'OptiSpace — Gestion des tickets Wi-Fi',
    short_name: 'OptiSpace',
    description: 'Plateforme de gestion des tickets et encaissements Wi-Fi',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f2a1d',
    theme_color: '#0f2a1d',
    icons: [
      { src: '/icon.png', sizes: '192x192', type: 'image/png' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
