import { create } from 'zustand';
import { getMeApi, loginApi, logoutApi, registerApi } from '@/lib/api';
import type {
  LedgerSummary,
  LoginParams,
  LoginResponse,
  RegisterParams,
  RegisterResponse,
  SafeUser,
} from '@/types/auth';

export type { LedgerSummary, SafeUser };

interface AppState {
  // 账本与系统状态
  activeLedger: LedgerSummary | null;
  isOnline: boolean;
  setActiveLedger: (ledger: LedgerSummary | null) => void;
  setIsOnline: (isOnline: boolean) => void;

  // 用户与登录认证状态
  user: SafeUser | null;
  isAuthenticated: boolean;
  authChecked: boolean;
  setUser: (user: SafeUser | null) => void;

  // 认证 Actions
  checkAuth: () => Promise<boolean>;
  login: (params: LoginParams) => Promise<LoginResponse>;
  register: (params: RegisterParams) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  activeLedger: null,
  isOnline: true,
  user: null,
  isAuthenticated: false,
  authChecked: false,

  setActiveLedger: (activeLedger) => set({ activeLedger }),
  setIsOnline: (isOnline) => set({ isOnline }),
  setUser: (user) => set({ user, isAuthenticated: !!user }),

  checkAuth: async () => {
    try {
      const user = await getMeApi();
      set({ user, isAuthenticated: true, authChecked: true });
      return true;
    } catch {
      set({ user: null, isAuthenticated: false, authChecked: true });
      return false;
    }
  },

  login: async (params) => {
    const res = await loginApi(params);
    const active = res.ledgers?.[0] ?? null;
    set({
      user: res.user,
      isAuthenticated: true,
      authChecked: true,
      activeLedger: active,
    });
    return res;
  },

  register: async (params) => {
    const res = await registerApi(params);
    set({
      user: res.user,
      isAuthenticated: true,
      authChecked: true,
      activeLedger: res.defaultLedger,
    });
    return res;
  },

  logout: async () => {
    try {
      await logoutApi();
    } catch {
      // 忽略登出请求网络报错
    } finally {
      set({
        user: null,
        isAuthenticated: false,
        activeLedger: null,
        authChecked: true,
      });
    }
  },
}));
