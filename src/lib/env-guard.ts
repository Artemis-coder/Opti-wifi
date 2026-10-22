/**
 * Environment & Database Safety Guardrail
 * 
 * Ce module protège la base de données de production et garantit l'isolation
 * stricte entre les environnements Local, Preview et Production.
 */

export type RuntimeEnvironment = 'production' | 'preview' | 'development' | 'test';

export interface EnvironmentSummary {
  runtimeEnv: RuntimeEnvironment;
  isProduction: boolean;
  isPreview: boolean;
  isDevelopment: boolean;
  databaseHost: string;
  isProductionDatabase: boolean;
  isDevelopmentDatabase: boolean;
  isIsolated: boolean;
}

// Signatures connues des clusters Neon du projet
const NEON_PROD_HOST_SIGNATURE = 'ep-flat-term-aymd9rhb';
const NEON_DEV_HOST_SIGNATURE = 'ep-crimson-shape-ayvbw15x';

/**
 * Détermine l'environnement d'exécution actuel en se basant sur les variables Vercel et Node.
 */
export function getRuntimeEnvironment(): RuntimeEnvironment {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === 'production') return 'production';
  if (vercelEnv === 'preview') return 'preview';
  if (vercelEnv === 'development') return 'development';
  if (process.env.NODE_ENV === 'test') return 'test';
  if (process.env.NODE_ENV === 'production') return 'production';
  return 'development';
}

/**
 * Extrait et masque l'hôte d'une chaîne de connexion PostgreSQL pour les logs et diagnostics.
 */
export function extractDatabaseHost(connectionString?: string): string {
  if (!connectionString) return 'non-configuré';
  try {
    const match = connectionString.match(/@([^/:]+)/);
    if (!match || !match[1]) return 'hôte-inconnu';
    return match[1];
  } catch {
    return 'invalide';
  }
}

/**
 * Masque un nom d'hôte pour l'affichage sécurisé (ex: ep-crimson-***.neon.tech).
 */
export function maskHost(host: string): string {
  if (!host || host === 'non-configuré' || host === 'invalide') return host;
  const parts = host.split('.');
  if (parts.length > 0 && parts[0].length > 8) {
    const prefix = parts[0].slice(0, 8);
    return `${prefix}***.${parts.slice(1).join('.')}`;
  }
  return host;
}

/**
 * Valide que la chaîne de connexion correspond bien à l'environnement d'exécution.
 * Bloque toute tentative d'un environnement non-production de se connecter à la base de production.
 */
export function validateDatabaseConnection(connectionString?: string): void {
  const env = getRuntimeEnvironment();
  const host = extractDatabaseHost(connectionString);
  const isProdHost = host.includes(NEON_PROD_HOST_SIGNATURE);
  const isDevHost = host.includes(NEON_DEV_HOST_SIGNATURE);

  // Règle 1 : Un environnement de test, local dev ou Vercel Preview ne doit JAMAIS toucher la base de production
  if ((env === 'preview' || env === 'development' || env === 'test') && isProdHost) {
    const allowOverride = process.env.ALLOW_PROD_DB_IN_DEV === 'true';
    if (!allowOverride) {
      const msg = `[SECURITY GUARDRAIL] ALERTE SÉCURITÉ : Tentative de connexion à la base de données Neon de PRODUCTION depuis un environnement non-production (${env}). ` +
        `Host détecté: ${maskHost(host)}. L'opération a été bloquée pour protéger les données réelles. ` +
        `Veuillez configurer DATABASE_URL vers la base Neon de développement (branche vercel-dev).`;
      console.error(msg);
      throw new Error(msg);
    } else {
      console.warn(`[SECURITY WARNING] Connexion à la base de production autorisée explicitement via ALLOW_PROD_DB_IN_DEV dans l'environnement ${env}.`);
    }
  }

  // Règle 2 : L'environnement de production ne doit pas accidentellement pointer vers une base de dev
  if (env === 'production' && isDevHost) {
    const msg = `[SECURITY GUARDRAIL] ALERTE CONFIGURATION : L'environnement de PRODUCTION pointe vers la base de données de DÉVELOPPEMENT. ` +
      `Host détecté: ${maskHost(host)}. Connexion bloquée pour éviter toute perte d'intégrité.`;
    console.error(msg);
    throw new Error(msg);
  }
}

/**
 * Retourne un résumé d'audit de l'environnement (sans secrets ni mots de passe).
 */
export function getEnvironmentSummary(connectionString?: string): EnvironmentSummary {
  const runtimeEnv = getRuntimeEnvironment();
  const host = extractDatabaseHost(connectionString);
  const isProduction = runtimeEnv === 'production';
  const isPreview = runtimeEnv === 'preview';
  const isDevelopment = runtimeEnv === 'development' || runtimeEnv === 'test';
  const isProductionDatabase = host.includes(NEON_PROD_HOST_SIGNATURE);
  const isDevelopmentDatabase = host.includes(NEON_DEV_HOST_SIGNATURE);

  // La base est isolée si elle est en dev pour du dev/preview, ou en prod pour de la prod
  const isIsolated = (isPreview || isDevelopment) ? isDevelopmentDatabase : isProductionDatabase;

  return {
    runtimeEnv,
    isProduction,
    isPreview,
    isDevelopment,
    databaseHost: maskHost(host),
    isProductionDatabase,
    isDevelopmentDatabase,
    isIsolated,
  };
}

/**
 * Garde-fou strict pour les opérations destructives (reset, vidage de table, migration manuelle).
 * Empêche formellement l'exécution si la cible est la base de production sans bypass explicite.
 */
export function assertSafeDevelopmentDatabase(connectionString?: string, operationName: string = 'Opération destructive'): void {
  const host = extractDatabaseHost(connectionString);
  const isProdHost = host.includes(NEON_PROD_HOST_SIGNATURE);

  if (isProdHost && process.env.CONFIRM_DESTRUCTIVE_PROD_OP !== 'true') {
    throw new Error(
      `[SECURITY GUARDRAIL] ${operationName} REFUSÉE : Cette opération cible la base de données de PRODUCTION (${maskHost(host)}). ` +
      `Pour protéger les données clients, les opérations destructives sont interdites sur la production.`
    );
  }
}
