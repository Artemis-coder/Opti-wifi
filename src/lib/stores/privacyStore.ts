import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Masquage des montants : préférence mémorisée sur l'appareil (voir lib/privacy.ts)
interface PrivacyState {
  hideAmounts: boolean;
  toggleAmounts: () => void;
}

/** Préférence mémorisée sur l'appareil */
export const usePrivacyStore = create<PrivacyState>()(
  persist(
    (set) => ({
      hideAmounts: false,
      toggleAmounts: () => set((s) => ({ hideAmounts: !s.hideAmounts })),
    }),
    { name: 'optispace:hide-amounts', storage: createJSONStorage(() => localStorage) }
  )
);
