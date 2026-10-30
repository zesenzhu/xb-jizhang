import { create } from 'zustand';

export type SyncStatus = 'idle' | 'syncing' | 'succeeded' | 'failed' | 'conflict';

interface OfflineState {
  isOnline: boolean;
  syncStatus: SyncStatus;
  pendingCount: number;
  lastError: string | null;
  setOnline: (isOnline: boolean) => void;
  setSyncState: (state: {
    syncStatus: SyncStatus;
    pendingCount?: number;
    lastError?: string | null;
  }) => void;
}

export const useOfflineStore = create<OfflineState>((set) => ({
  isOnline: true,
  syncStatus: 'idle',
  pendingCount: 0,
  lastError: null,
  setOnline: (isOnline) => set({ isOnline }),
  setSyncState: ({ syncStatus, pendingCount, lastError }) =>
    set((state) => ({
      syncStatus,
      pendingCount: pendingCount ?? state.pendingCount,
      lastError: lastError === undefined ? state.lastError : lastError,
    })),
}));
