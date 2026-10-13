/* eslint-disable @typescript-eslint/no-explicit-any */
import { neon } from '@neondatabase/serverless';
import type { NeonQueryFunction } from '@neondatabase/serverless';

const NEON_DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

let sqlInstance: NeonQueryFunction<any, any> | null = null;

export function getSql(): NeonQueryFunction<any, any> {
  if (!sqlInstance) {
    if (!NEON_DATABASE_URL) {
      throw new Error('DATABASE_URL is not configured. Set DATABASE_URL in your environment variables.');
    }
    sqlInstance = neon(NEON_DATABASE_URL);
  }
  return sqlInstance;
}

export interface QueryResult {
  rows: any[];
  rowCount: number;
}

export function makeError(message: string, code?: string): { message: string; code?: string; details: string; hint: string } {
  return { message, code, details: '', hint: '' };
}

export type SupabaseError = { message: string; code?: string; details?: string; hint?: string };

export async function query(text: string, params: any[] = []): Promise<QueryResult> {
  const sql = getSql();
  const result: any = await sql.query(text, params);

  let rows: any[];
  if (Array.isArray(result)) {
    rows = result;
  } else if (result && Array.isArray(result.rows)) {
    rows = result.rows;
  } else if (result && typeof result[0] !== 'undefined') {
    rows = Array.from(result as ArrayLike<any>);
  } else {
    rows = [];
  }

  return {
    rows,
    rowCount: rows.length,
  };
}

export async function queryOne<T = any>(text: string, params: any[] = []): Promise<T | null> {
  const result = await query(text, params);
  return result.rows[0] || null;
}
