/* eslint-disable @typescript-eslint/no-explicit-any */
import { query, queryOne, TableBuilder, type SupabaseError } from './query-builder';
import { hashPassword } from './auth';
const uuidv4 = () => crypto.randomUUID();

interface AdminAuthUser {
  id: string;
  email: string;
  user_metadata?: Record<string, any> | null;
  app_metadata?: Record<string, any> | null;
  email_confirmed: boolean;
  banned_until?: string | null;
  created_at: string;
  updated_at: string;
}

export function createAdminClient() {
  const adminAuth = {
    admin: {
      listUsers: async (): Promise<{ data: { users: AdminAuthUser[] }; error: SupabaseError | null }> => {
        try {
          const result = await query(
            'SELECT id, email, user_metadata, app_metadata, email_confirmed, banned_until, created_at, updated_at FROM users ORDER BY created_at DESC'
          );
          const users: AdminAuthUser[] = (result.rows || []).map(row => ({
            id: row.id,
            email: row.email,
            user_metadata: row.user_metadata,
            app_metadata: row.app_metadata,
            email_confirmed: row.email_confirmed,
            banned_until: row.banned_until,
            created_at: row.created_at,
            updated_at: row.updated_at,
          }));
          return { data: { users }, error: null };
        } catch (err: any) {
          return { data: { users: [] }, error: { message: err.message || 'Database error' } };
        }
      },

      createUser: async (attrs: {
        email: string;
        password?: string;
        email_confirm?: boolean;
        user_metadata?: Record<string, any>;
      }): Promise<{ data: { user: AdminAuthUser | null }; error: SupabaseError | null }> => {
        try {
          const passwordHash = attrs.password ? await hashPassword(attrs.password) : await hashPassword(uuidv4());
          const result = await query(
            `INSERT INTO users (email, password_hash, email_confirmed, user_metadata, app_metadata, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
             RETURNING id, email, user_metadata, app_metadata, email_confirmed, banned_until, created_at, updated_at`,
            [
              attrs.email.toLowerCase(),
              passwordHash,
              attrs.email_confirm ?? true,
              JSON.stringify(attrs.user_metadata || {}),
              JSON.stringify({ role: attrs.user_metadata?.role || 'collecteur' }),
            ]
          );

          if (!result.rows || result.rows.length === 0) {
            return { data: { user: null }, error: { message: 'Failed to create user' } };
          }

          const row = result.rows[0];
          return {
            data: {
              user: {
                id: row.id,
                email: row.email,
                user_metadata: row.user_metadata,
                app_metadata: row.app_metadata,
                email_confirmed: row.email_confirmed,
                banned_until: row.banned_until,
                created_at: row.created_at,
                updated_at: row.updated_at,
              }
            },
            error: null,
          };
        } catch (err: any) {
          return { data: { user: null }, error: { message: err.message || 'Database error' } };
        }
      },

      updateUserById: async (
        userId: string,
        attrs: { ban_duration?: string; email?: string; password?: string; user_metadata?: any; app_metadata?: any }
      ): Promise<{ data: { user: AdminAuthUser | null }; error: SupabaseError | null }> => {
        try {
          const updates: string[] = [];
          const params: any[] = [];
          let idx = 1;

          if (attrs.email !== undefined) {
            updates.push(`email = $${idx++}`);
            params.push(attrs.email);
          }
          if (attrs.password !== undefined) {
            const hash = await hashPassword(attrs.password);
            updates.push(`password_hash = $${idx++}`);
            params.push(hash);
          }
          if (attrs.user_metadata !== undefined) {
            updates.push(`user_metadata = $${idx++}`);
            params.push(JSON.stringify(attrs.user_metadata));
          }
          if (attrs.app_metadata !== undefined) {
            updates.push(`app_metadata = $${idx++}`);
            params.push(JSON.stringify(attrs.app_metadata));
          }

          if (attrs.ban_duration !== undefined) {
            if (attrs.ban_duration === 'none') {
              updates.push(`banned_until = NULL`);
            } else {
              updates.push(`banned_until = NOW() + INTERVAL '${attrs.ban_duration.replace(/'/g, '')}'`);
            }
          }

          if (updates.length === 0) {
            const result = await query(
              'SELECT id, email, user_metadata, app_metadata, email_confirmed, banned_until, created_at, updated_at FROM users WHERE id = $1',
              [userId]
            );
            return { data: { user: result.rows?.[0] || null }, error: null };
          }

          const result = await query(
            `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx}
             RETURNING id, email, user_metadata, app_metadata, email_confirmed, banned_until, created_at, updated_at`,
            [...params, userId]
          );

          if (!result.rows || result.rows.length === 0) {
            return { data: { user: null }, error: { message: 'User not found' } };
          }

          return { data: { user: result.rows[0] }, error: null };
        } catch (err: any) {
          return { data: { user: null }, error: { message: err.message || 'Database error' } };
        }
      },

      generateLink: async (_opts: { type: string; email: string }): Promise<{ data: any; error: SupabaseError | null }> => {
        try {
          return {
            data: {
              properties: {
                action: _opts.type,
                email: _opts.email,
                created_at: new Date().toISOString(),
              },
            },
            error: null,
          };
        } catch (err: any) {
          return { data: null, error: { message: err.message || 'Database error' } };
        }
      },
    },
  };

  return {
    auth: adminAuth,
    from: (table: string): TableBuilder => new TableBuilder(table, false),
    rpc: (name: string, params: Record<string, any>): TableBuilder => {
      const builder = new TableBuilder('', false);
      builder.rpc(name, params);
      return builder;
    },
  };
}

export const adminClient = createAdminClient();
