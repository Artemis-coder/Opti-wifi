import { query } from '@/lib/neon/db';
import { notifyDatabaseAlert } from '@/lib/telegram';

interface HealthCheckResult {
  healthy: boolean;
  checks: {
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message: string;
    duration_ms: number;
  }[];
}

export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const checks: HealthCheckResult['checks'] = [];
  const startTotal = Date.now();

  const runCheck = async (name: string, sql: string) => {
    const start = Date.now();
    try {
      const result = await query(sql);
      checks.push({
        name,
        status: 'pass',
        message: 'OK',
        duration_ms: Date.now() - start,
      });
    } catch (error) {
      checks.push({
        name,
        status: 'fail',
        message: error instanceof Error ? error.message : 'Erreur inconnue',
        duration_ms: Date.now() - start,
      });
    }
  };

  await runCheck('Connexion', 'SELECT 1');
  await runCheck('Tables wifi_spaces', 'SELECT COUNT(*) FROM wifi_spaces');
  await runCheck('Utilisateurs', 'SELECT COUNT(*) FROM users');
  await runCheck('Abonnements', 'SELECT COUNT(*) FROM subscriptions');

  const failed = checks.filter(c => c.status === 'fail').length;
  const warned = checks.filter(c => c.status === 'warn').length;

  if (failed > 0 || warned > 0) {
    await notifyDatabaseAlert({
      type: failed > 0 ? 'error' : 'high_load',
      database: 'neondb',
      message: `${failed} échec(s), ${warned} avertissement(s) sur ${checks.length} vérifications`,
      details: { checks: checks.map(c => ({ [c.name]: c.status })) },
    });
  }

  return {
    healthy: failed === 0,
    checks,
  };
}

export async function checkSlowQueries(thresholdMs = 1000) {
  try {
    const result = await Neon_run_sql(`
      SELECT query, mean_exec_time, calls, total_exec_time
      FROM pg_stat_statements
      WHERE mean_exec_time > ${thresholdMs}
      ORDER BY mean_exec_time DESC
      LIMIT 10
    `);

    if (result.rows.length > 0) {
      await notifyDatabaseAlert({
        type: 'slow_query',
        database: 'neondb',
        message: `${result.rows.length} requête(s) lente(s) détectée(s) (>${thresholdMs}ms)`,
        details: { queries: result.rows },
      });
    }
  } catch (error) {
    console.error('Slow query check failed:', error);
  }
}

export async function checkConnectionPool() {
  try {
    const result = await Neon_run_sql(`
      SELECT 
        count(*) as total_connections,
        count(*) filter (where state = 'active') as active_connections,
        count(*) filter (where state = 'idle') as idle_connections,
        setting::int as max_connections
      FROM pg_stat_activity, pg_settings
      WHERE pg_settings.name = 'max_connections'
    `);

    const row = result.rows[0];
    const usagePercent = (row.total_connections / row.max_connections) * 100;

    if (usagePercent > 80) {
      await notifyDatabaseAlert({
        type: 'high_load',
        database: 'neondb',
        message: `Pool de connexions à ${usagePercent.toFixed(1)}% (${row.total_connections}/${row.max_connections})`,
        details: row,
      });
    }
  } catch (error) {
    console.error('Connection pool check failed:', error);
  }
}

export async function runAllHealthChecks() {
  await checkDatabaseHealth();
  await checkSlowQueries();
  await checkConnectionPool();
}