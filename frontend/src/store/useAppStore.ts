import { create } from 'zustand';

export interface LedgerSummary {
  id: string;
  name: string;
  type: 'PERSONAL' | 'SHARED';
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
}

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
