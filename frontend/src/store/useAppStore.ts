import { create } from 'zustand';
import type { LedgerSummary } from '@/types/auth';

export type { LedgerSummary };

interface AppState {
  activeLedger: LedgerSummary | null;
  isOnline: boolean;
  setActiveLedger: (ledger: LedgerSummary | null) => void;
  setIsOnline: (isOnline: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeLedger: null,
  isOnline: true,
  setActiveLedger: (activeLedger) => set({ activeLedger }),
  setIsOnline: (isOnline) => set({ isOnline }),
}));
