import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_SUMMARY_BACKGROUND,
  type SkinThemeId,
  type SummaryBackground,
} from '@/lib/skin/skin';

interface SkinState {
  themeId: SkinThemeId;
  summaryBackground: SummaryBackground;
  setTheme: (themeId: SkinThemeId) => void;
  setSummaryBackground: (background: SummaryBackground) => void;
  reset: () => void;
}

/**
 * 皮肤偏好。只存"选择"，不存图片本体：
 * 图片在 IndexedDB，这里只保留键，避免 localStorage 被 base64 撑爆。
 */
export const useSkinStore = create<SkinState>()(
  persist(
    (set) => ({
      themeId: 'default',
      summaryBackground: DEFAULT_SUMMARY_BACKGROUND,
      setTheme: (themeId) => set({ themeId }),
      setSummaryBackground: (summaryBackground) => set({ summaryBackground }),
      reset: () =>
        set({ themeId: 'default', summaryBackground: DEFAULT_SUMMARY_BACKGROUND }),
    }),
    {
      name: 'jizhang.skin.v1',
      version: 1,
      partialize: (state) => ({
        themeId: state.themeId,
        summaryBackground: state.summaryBackground,
      }),
    },
  ),
);
