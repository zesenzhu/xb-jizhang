import { create } from 'zustand';

interface WorkspaceState {
  currentLedgerId: string | null;
  setCurrentLedgerId: (currentLedgerId: string | null) => void;
  clear: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  currentLedgerId: null,
  setCurrentLedgerId: (currentLedgerId) => set({ currentLedgerId }),
  clear: () => set({ currentLedgerId: null }),
}));
