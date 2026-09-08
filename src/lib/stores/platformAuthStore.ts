import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { PlatformUser, PlatformRole } from '@/types/platform';

interface SupabaseClientLike {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null } }>;
  };
  from(table: string): {
    select(cols: string): {
      eq(col: string, val: string): {
        eq(col: string, val: boolean): {
          single(): Promise<{ data: PlatformUser | null }>;
        };
      };
    };
  };
}

interface PlatformAuthState {
  platformUser: PlatformUser | null;
  isLoading: boolean;
  setPlatformUser: (platformUser: PlatformUser | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  logout: () => void;
  checkSession: (supabase: SupabaseClientLike) => Promise<void>;
}

const customStorage = {
  getItem: (name: string) => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(name);
  },
  setItem: (name: string, value: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(name, value);
    }
  },
  removeItem: (name: string) => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(name);
    }
  },
};

export const usePlatformAuthStore = create<PlatformAuthState>()(
  persist(
    (set, get) => ({
      platformUser: null,
      isLoading: true,
      setPlatformUser: (platformUser: PlatformUser | null) => set({ platformUser, isLoading: false }),
      setIsLoading: (isLoading) => set({ isLoading }),
      logout: () => set({ platformUser: null, isLoading: false }),
      checkSession: async (supabase: SupabaseClientLike) => {
        set({ isLoading: true });
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (user) {
            const { data: pu } = await supabase
              .from('platform_users')
              .select('*')
              .eq('auth_user_id', user.id)
              .eq('is_active', true)
              .single();

            if (pu) {
              set({ platformUser: pu, isLoading: false });
              return;
            }
          }
          set({ platformUser: null, isLoading: false });
        } catch {
          set({ platformUser: null, isLoading: false });
        }
      },
    }),
    {
      name: 'optiwifi-platform-auth-storage',
      storage: createJSONStorage(() => customStorage),
      partialize: (state) => ({ platformUser: state.platformUser }),
      onRehydrateStorage: () => (state) => {
        // Always finish loading after rehydration, even if storage is empty/corrupt
        state?.setIsLoading(false);
      },
    }
  )
);

export function isPlatformSuperAdmin(role?: PlatformRole): boolean {
  return role === 'super_admin' || role === 'platform_support';
}

export function isSuperAdmin(role?: PlatformRole): boolean {
  return role === 'super_admin';
}
