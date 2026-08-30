import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { WifiSpace } from '@/types/database';

interface SpaceState {
  currentSpaceId: string | null;
  spaces: WifiSpace[];
  setCurrentSpaceId: (id: string | null) => void;
  setSpaces: (spaces: WifiSpace[]) => void;
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

export const useSpaceStore = create<SpaceState>()(
  persist(
    (set) => ({
      currentSpaceId: null,
      spaces: [],
      setCurrentSpaceId: (id) => set({ currentSpaceId: id }),
      setSpaces: (spaces) => set({ spaces }),
    }),
    {
      name: 'optiwifi-space-storage',
      storage: createJSONStorage(() => customStorage),
      partialize: (state) => ({ currentSpaceId: state.currentSpaceId }),
    }
  )
);
