import { create } from 'zustand';
import type { AdminSummary } from '@/lib/api/auth-types';
import type { AuthStatus } from './userAuthStore';

interface AdminAuthState {
  currentAdmin: AdminSummary | null;
  status: AuthStatus;
  setCurrentAdmin: (currentAdmin: AdminSummary) => void;
  setStatus: (status: AuthStatus) => void;
  clear: () => void;
}

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  currentAdmin: null,
  status: 'unknown',
  setCurrentAdmin: (currentAdmin) => set({ currentAdmin, status: 'authenticated' }),
  setStatus: (status) => set({ status }),
  clear: () => set({ currentAdmin: null, status: 'unauthenticated' }),
}));
