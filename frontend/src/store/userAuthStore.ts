import { create } from 'zustand';
import type { UserSummary } from '@/lib/api/auth-types';

export type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated' | 'refreshing';

interface UserAuthState {
  currentUser: UserSummary | null;
  status: AuthStatus;
  setCurrentUser: (currentUser: UserSummary) => void;
  setStatus: (status: AuthStatus) => void;
  clear: () => void;
}

export const useUserAuthStore = create<UserAuthState>((set) => ({
  currentUser: null,
  status: 'unknown',
  setCurrentUser: (currentUser) => set({ currentUser, status: 'authenticated' }),
  setStatus: (status) => set({ status }),
  clear: () => set({ currentUser: null, status: 'unauthenticated' }),
}));
