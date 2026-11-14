/**
 * Captures de l'outil (public/screens/). La version est ajoutée à l'adresse pour que
 * le cache des images optimisées (navigateur, CDN Vercel) ne serve jamais une ancienne
 * capture. `npm run capture` la met à jour automatiquement.
 */
export const SCREENS_VERSION = "20261114";

export const screen = (name: string) => `/screens/${name}.png?v=${SCREENS_VERSION}`;
