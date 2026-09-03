import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { PlatformUser, PlatformRole } from '@/types/platform';

interface PlatformAuthState {
  platformUser: PlatformUser | null;
  isLoading: boolean;
  setPlatformUser: (user: PlatformUser | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  logout: () => void;
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
    (set) => ({
      platformUser: null,
      isLoading: true,
      setPlatformUser: (platformUser: PlatformUser | null) => set({ platformUser, isLoading: false }),
      setIsLoading: (isLoading) => set({ isLoading }),
      logout: () => set({ platformUser: null, isLoading: false }),
    }),
    {
      name: 'optiwifi-platform-auth-storage',
      storage: createJSONStorage(() => customStorage),
      partialize: (state) => ({ platformUser: state.platformUser }),
      onRehydrateStorage: () => (state) => {
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
