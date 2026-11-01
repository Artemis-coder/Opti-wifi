/* eslint-disable @typescript-eslint/no-explicit-any */
import { TableBuilder, type SupabaseError, type AuthUser } from './query-builder';

export type NeonError = SupabaseError;

export interface BrowserAuthSession {
  access_token: string;
  user: AuthUser;
}

const AUTH_COOKIE_NAME = 'neon-auth-token';

let _singletonClient: any = null;

function initBrowserClient() {
  const auth = {
    getUser: async (): Promise<{ data: { user: AuthUser | null }; error: null }> => {
      const offline = await import('@/lib/offline/store');
      try {
        const res = await fetch('/api/auth/session', {
          credentials: 'include',
        });
        if (!res.ok) {
          offline.rememberSessionUser(null);
          return { data: { user: null }, error: null };
        }
        const json = await res.json();
        // Session vérifiée en ligne : mémorisée pour rester connecté hors ligne
        offline.rememberSessionUser(json.user || null);
        if (json.user) return { data: { user: json.user }, error: null };
        return { data: { user: null }, error: null };
      } catch (err) {
        // Hors ligne : dernière session vérifiée sur cet appareil
        if (offline.isNetworkError(err)) return { data: { user: offline.cachedSessionUser<AuthUser>() }, error: null };
        return { data: { user: null }, error: null };
      }
    },

    signInWithPassword: async (
      creds: { email: string; password: string }
    ): Promise<{ data: { user: AuthUser | null; session: BrowserAuthSession | null }; error: NeonError | null }> => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(creds),
        });

        const json = await res.json();
        if (!res.ok) {
          return { data: { user: null, session: null }, error: { message: json.error || 'Login failed' } as NeonError };
        }
        // Nouvelle connexion : rien d'un compte précédent ne reste sur l'appareil
        const offline = await import('@/lib/offline/store');
        await offline.clearOfflineData();
        offline.rememberSessionUser(json.user || null);

        return {
          data: {
            user: json.user || null,
            session: json.session || null,
          },
          error: null,
        };
      } catch (err: any) {
        return { data: { user: null, session: null }, error: { message: err.message || 'Network error' } as NeonError };
      }
    },

    signOut: async (): Promise<{ error: NeonError | null }> => {
      // Déconnexion : données hors ligne effacées (cache, session, pages enregistrées)
      try {
        const offline = await import('@/lib/offline/store');
        await offline.clearOfflineData();
      } catch {}
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
        });
        document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0`;
      } catch {}
      return { error: null };
    },

    resetPasswordForEmail: async (
      email: string,
      _options?: { redirectTo?: string }
    ): Promise<{ data: any; error: NeonError | null }> => {
      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email }),
        });
        const json = await res.json();
        if (!res.ok) return { data: null, error: { message: json.error || 'Failed' } as NeonError };
        return { data: json, error: null };
      } catch (err: any) {
        return { data: null, error: { message: err.message || 'Network error' } as NeonError };
      }
    },

    updateUser: async (
      attrs: { password?: string }
    ): Promise<{ data: { user: AuthUser | null } | null; error: NeonError | null }> => {
      if (attrs.password) {
        try {
          const res = await fetch('/api/auth/update-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ password: attrs.password }),
          });
          const json = await res.json();
          if (!res.ok) return { data: null, error: { message: json.error || 'Update failed' } as NeonError };
          return { data: { user: json.user || null }, error: null };
        } catch (err: any) {
          return { data: null, error: { message: err.message || 'Network error' } as NeonError };
        }
      }
      return { data: null, error: null };
    },

    setSession: async (_session: { access_token: string; refresh_token: string }): Promise<{
      data: { user: AuthUser | null; session: BrowserAuthSession | null };
      error: NeonError | null;
    }> => {
      return { data: { user: null, session: null }, error: null };
    },

    admin: {
      listUsers: async (): Promise<{ data: { users: AuthUser[] }; error: NeonError | null }> => {
        try {
          const res = await fetch('/api/admin/users', { credentials: 'include' });
          const json = await res.json();
          if (!res.ok) return { data: { users: [] }, error: { message: json.error || 'Failed' } as NeonError };
          return { data: { users: json.users || [] }, error: null };
        } catch (err: any) {
          return { data: { users: [] }, error: { message: err.message || 'Network error' } as NeonError };
        }
      },
      createUser: async (attrs: {
        email: string;
        password?: string;
        email_confirm?: boolean;
        user_metadata?: Record<string, any>;
      }): Promise<{ data: { user: AuthUser | null }; error: NeonError | null }> => {
        try {
          const res = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(attrs),
          });
          const json = await res.json();
          if (!res.ok) return { data: { user: null }, error: { message: json.error || 'Create failed' } as NeonError };
          return { data: { user: json.user || null }, error: null };
        } catch (err: any) {
          return { data: { user: null }, error: { message: err.message || 'Network error' } as NeonError };
        }
      },
      updateUserById: async (
        userId: string,
        attrs: { ban_duration?: string; email?: string; password?: string; user_metadata?: any }
      ): Promise<{ data: any; error: NeonError | null }> => {
        try {
          const res = await fetch(`/api/admin/users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(attrs),
          });
          const json = await res.json();
          if (!res.ok) return { data: null, error: { message: json.error || 'Update failed' } as NeonError };
          return { data: json.user || null, error: null };
        } catch (err: any) {
          return { data: null, error: { message: err.message || 'Network error' } as NeonError };
        }
      },
      generateLink: async (opts: { type: string; email: string }): Promise<{ data: any; error: NeonError | null }> => {
        try {
          const res = await fetch('/api/admin/generate-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(opts),
          });
          const json = await res.json();
          if (!res.ok) return { data: null, error: { message: json.error || 'Failed' } as NeonError };
          return { data: json, error: null };
        } catch (err: any) {
          return { data: null, error: { message: err.message || 'Network error' } as NeonError };
        }
      },
    },
  };

  return {
    auth,
    from: (table: string): TableBuilder => new TableBuilder(table, true),
    rpc: (name: string, params: Record<string, any>): TableBuilder => {
      const builder = new TableBuilder('', true);
      builder.rpc(name, params);
      return builder;
    },
  };
}

export function createBrowserClient() {
  if (typeof window === 'undefined') {
    return initBrowserClient();
  }
  if (!_singletonClient) {
    _singletonClient = initBrowserClient();
  }
  return _singletonClient;
}

