import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useAuthStore } from '@/lib/stores/authStore';

// Consultation seule (abonnement expiré), voir lib/read-only.ts. Mémorisé sur l'appareil pour
// rester valable hors ligne, et rattaché au compte : un autre compte connecté ensuite sur le
// même appareil (ex. le super admin) n'est pas concerné.
interface AccessState {
  /** Compte en consultation seule (null : aucun) */
  readOnlyUserId: string | null;
  setReadOnly: (userId: string, readOnly: boolean) => void;
}

export const useAccessStore = create<AccessState>()(
  persist(
    (set) => ({
      readOnlyUserId: null,
      setReadOnly: (userId, readOnly) => set({ readOnlyUserId: readOnly ? userId : null }),
    }),
    { name: 'optispace:read-only', storage: createJSONStorage(() => localStorage) }
  )
);

/** Vrai si le compte connecté est en consultation seule (hook React). */
export function useReadOnly(): boolean {
  const userId = useAuthStore((s) => s.user?.id);
  const readOnlyUserId = useAccessStore((s) => s.readOnlyUserId);
  return !!userId && userId === readOnlyUserId;
}

/** Même règle, hors React (constructeur de requêtes). */
export function isReadOnly(): boolean {
  const userId = useAuthStore.getState().user?.id;
  return !!userId && userId === useAccessStore.getState().readOnlyUserId;
}
