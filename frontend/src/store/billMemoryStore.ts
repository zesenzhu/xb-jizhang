import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 记账表单的「上次选择」记忆。
 *
 * 只记用户每次都会重复填的字段：分类、账户、付款人。
 * 金额、商家、备注属于一次性内容，记下来只会变成误填。
 *
 * 按账本分别存储 —— 不同账本的分类和账户互不相通，
 * 全局只存一份会让用户在 B 账本选中 A 账本的分类 ID。
 */
export interface LastBillSelection {
  /** 分类按收支类型分别记忆：支出与收入的分类互不通用 */
  categoryByType: Record<'EXPENSE' | 'INCOME', string | null>;
  accountId: string | null;
  payerId: string | null;
}

export const EMPTY_SELECTION: LastBillSelection = {
  categoryByType: { EXPENSE: null, INCOME: null },
  accountId: null,
  payerId: null,
};

interface BillMemoryState {
  /** ledgerId → 该账本上次的选择 */
  byLedger: Record<string, LastBillSelection>;
  remember: (
    ledgerId: string,
    kind: 'EXPENSE' | 'INCOME',
    selection: { categoryId: string | null; accountId: string | null; payerId: string | null },
  ) => void;
  forget: (ledgerId: string) => void;
  clear: () => void;
}

export const useBillMemoryStore = create<BillMemoryState>()(
  persist(
    (set) => ({
      byLedger: {},
      remember: (ledgerId, kind, selection) =>
        set((state) => {
          const previous = state.byLedger[ledgerId] ?? EMPTY_SELECTION;
          return {
            byLedger: {
              ...state.byLedger,
              [ledgerId]: {
                categoryByType: {
                  ...previous.categoryByType,
                  [kind]: selection.categoryId,
                },
                accountId: selection.accountId,
                payerId: selection.payerId,
              },
            },
          };
        }),
      forget: (ledgerId) =>
        set((state) => {
          const next = { ...state.byLedger };
          delete next[ledgerId];
          return { byLedger: next };
        }),
      clear: () => set({ byLedger: {} }),
    }),
    {
      name: 'xiaobao-bill-memory',
      // 只持久化数据，不把方法写进 storage。
      partialize: (state) => ({ byLedger: state.byLedger }),
    },
  ),
);

/** 读取某个账本上次的选择；没有记录时返回空选择。 */
export function selectLastSelection(
  ledgerId: string,
): (state: BillMemoryState) => LastBillSelection {
  return (state) => state.byLedger[ledgerId] ?? EMPTY_SELECTION;
}
