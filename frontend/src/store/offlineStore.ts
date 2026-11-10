import { create } from 'zustand';

export type SyncStatus = 'idle' | 'syncing' | 'succeeded' | 'failed' | 'conflict';

interface OfflineState {
  isOnline: boolean;
  syncStatus: SyncStatus;
  pendingCount: number;
  lastError: string | null;
  lastSyncAt: string | null;
  stateVersion: number;
  syncRequestedAt: number;
  setOnline: (isOnline: boolean) => void;
  setSyncState: (state: {
    syncStatus: SyncStatus;
    pendingCount?: number;
    lastError?: string | null;
    lastSyncAt?: string | null;
  }) => void;
  requestSync: () => void;
}

export const useOfflineStore = create<OfflineState>((set) => ({
  isOnline: true,
  syncStatus: 'idle',
  pendingCount: 0,
  lastError: null,
  lastSyncAt: null,
  stateVersion: 0,
  syncRequestedAt: 0,
  setOnline: (isOnline) => set({ isOnline }),
  setSyncState: ({ syncStatus, pendingCount, lastError, lastSyncAt }) =>
    set((state) => ({
      syncStatus,
      pendingCount: pendingCount ?? state.pendingCount,
      lastError: lastError === undefined ? state.lastError : lastError,
      lastSyncAt: lastSyncAt === undefined ? state.lastSyncAt : lastSyncAt,
      stateVersion: state.stateVersion + 1,
    })),
  requestSync: () => set({ syncRequestedAt: Date.now() }),
}));
