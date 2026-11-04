'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, X } from 'lucide-react';
import { createTransaction } from '@/lib/api/transaction-api';
import { cn } from '@/lib/utils';
import { getCategories } from '@/lib/api/category-api';
import { getAccounts } from '@/lib/api/account-api';
import { ApiRequestError } from '@/lib/api/errors';
import { queryKeys, queryStaleTime } from '@/lib/query/query-config';
import { amountTextFromCents, parseAmountText } from '@/lib/bill/amount';
import { buildCategoryTree, categoryPathText } from '@/lib/bill/category-tree';
import { formatBillTime } from '@/lib/bill/bill-group';
import {
  NOTE_MAX_LENGTH,
  billFormReducer,
  createInitialBillForm,
} from '@/lib/bill/bill-form';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useOfflineStore } from '@/store/offlineStore';
import { AmountKeypad } from '@/components/mobile/AmountKeypad';
import { AccountPickerSheet } from './AccountPickerSheet';
import { CategoryGrid } from './CategoryGrid';
import { SheetMetaFields } from './SheetMetaFields';
import { SheetQuickChips } from './SheetQuickChips';
import { SheetTypeSegment } from './SheetTypeSegment';

export interface BillCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ledgerId: string;
  ledgerName: string | null;
  /** 创建成功后回调，用于滚动到列表顶部 */
  onCreated?: () => void;
}

export function BillCreateSheet({
  open,
  onOpenChange,
  ledgerId,
  ledgerName,
  onCreated,
}: BillCreateSheetProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const [state, dispatch] = React.useReducer(
    billFormReducer,
    undefined,
    () => createInitialBillForm(),
  );
  const [accountPickerOpen, setAccountPickerOpen] = React.useState(false);
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const [wasOpen, setWasOpen] = React.useState(open);
  const [categoryError, setCategoryError] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const isOnline = useOfflineStore((store) => store.isOnline);

  // 每次打开都重置表单。用渲染期比较代替 effect，避免级联渲染与首帧闪旧值。
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      dispatch({ kind: 'reset', now: new Date() });
      setCategoryError(false);
      setConfirmDiscard(false);
    }
  }

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(ledgerId),
    queryFn: () => getCategories(ledgerId, { pageSize: 100 }),
    staleTime: queryStaleTime.categories,
    enabled: open && Boolean(ledgerId),
  });

  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts(ledgerId),
    queryFn: () => getAccounts(ledgerId, { pageSize: 100 }),
    staleTime: queryStaleTime.accounts,
    enabled: open && Boolean(ledgerId),
  });

  const categories = categoriesQuery.data?.items;
  // 分类树只随数据与类型变化；切换支出/收入会换一整棵树，不适合每次渲染重建。
  const categoryNodes = React.useMemo(
    () => buildCategoryTree((categories ?? []).filter((category) => category.type === state.type)),
    [categories, state.type],
  );
  const accounts = accountsQuery.data?.items ?? [];

  const amount = parseAmountText(state.amountText);
  /**
   * 输入小数点的瞬间 `12.` 还不是合法金额，但用户必须看到自己刚敲下的内容；
   * 直接回退到 0.00 会像是把输入清空了。
   */
  const amountDisplay = state.amountText.endsWith('.')
    ? `${state.amountText}00`
    : amount.cents === null
      ? '0.00'
      : amountTextFromCents(amount.cents);
  const categoryPath = categoryPathText(categories ?? [], state.categoryId);
  const accountName = accounts.find((account) => account.id === state.accountId)?.name ?? null;
  // 未来时间由事件处理器判定后写入 state.timeError：渲染期不读取当前时钟。
  const isFutureTime = state.timeError !== null;
  const canSubmit =
    amount.cents !== null && state.categoryId !== null && !isFutureTime && !state.submitting;
  /**
   * 提交键的禁用只覆盖「无论怎么点都不可能成功」的情况：金额非法、时间为未来、离线。
   * 未选分类不在此列——用户需要能点一下，才看得到高亮和滚动引导。
   */
  const submitBlocked = amount.cents === null || isFutureTime || !isOnline;

  const createMutation = useMutation({
    mutationFn: () =>
      createTransaction(ledgerId, {
        clientRequestId: state.clientRequestId,
        type: state.type,
        amountCents: amount.cents ?? 0,
        occurredAt: state.occurredAt,
        categoryId: state.categoryId ?? '',
        accountId: state.accountId,
        title: state.title.trim() || null,
        note: state.note.trim() || null,
        payerId: state.payerId,
      }),
  });

  const submit = async (keepOpen: boolean): Promise<void> => {
    if (state.submitting) return;

    if (state.categoryId === null) {
      // 未选分类：分类区就在滚动容器顶部，滚回顶部并在标题上高亮。
      setCategoryError(true);
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      dispatch({ kind: 'submitFailure', error: '请选择分类' });
      return;
    }

    if (!canSubmit || amount.cents === null) {
      dispatch({ kind: 'submitFailure', error: amount.error ?? (isFutureTime ? '不能记未来的账' : '当前无法提交') });
      return;
    }

    dispatch({ kind: 'submitStart' });
    try {
      await createMutation.mutateAsync();
      // 失效当前账本下全部账单与概览缓存，避免列表与概览口径不一致。
      await queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all(ledgerId) });
      await queryClient.invalidateQueries({ queryKey: ['ledger', ledgerId, 'statistics'] });

      dispatch({
        kind: 'resetForNext',
        clientRequestId: crypto.randomUUID(),
        occurredAt: new Date().toISOString(),
      });
      if (!keepOpen) onOpenChange(false);
      onCreated?.();
    } catch (error) {
      const message =
        error instanceof ApiRequestError
          ? error.code === 40321
            ? '你的账本权限已变化，请让账本所有者调整后再试'
            : error.message
          : '保存失败，请检查网络后重试';
      dispatch({ kind: 'submitFailure', error: message });
    }
  };

  const requestClose = (): boolean => {
    if (state.isDirty && !state.submitting) {
      setConfirmDiscard(true);
      return false;
    }
    return true;
  };

  const handleTimeChange = (value: string): void => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return;
    dispatch({
      kind: 'setOccurredAt',
      occurredAt: parsed.toISOString(),
      timeError: parsed.getTime() > Date.now() ? '不能记未来的账' : null,
    });
  };

  return (
    <>
      <BottomSheet
        open={open}
        onOpenChange={onOpenChange}
        variant="full"
        onBeforeClose={requestClose}
      >
        {/*
          顶部固定：关闭 + 支出/收入 + 账本名，一行放完。
          分段器必须相对整行居中，所以左右两侧各占等宽槽位（关闭键 / 账本名），
          用 grid 三列而不是 flex + gap，避免账本名长短把 tabs 推偏。
        */}
        <div className="shrink-0">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pt-3">
            <button
              type="button"
              aria-label="关闭"
              onClick={() => {
                if (requestClose()) onOpenChange(false);
              }}
              className="flex size-9 shrink-0 items-center justify-center justify-self-start rounded-full bg-app-card-subtle text-text-muted active:scale-95"
            >
              <X size={18} />
            </button>
            <SheetTypeSegment
              value={state.type}
              onChange={(type) => dispatch({ kind: 'setType', type })}
            />
            <span className="min-w-0 justify-self-end truncate text-right text-xs text-text-muted">
              {ledgerName ?? ''}
            </span>
          </div>
          {state.error && (
            <div
              role="alert"
              className="mx-4 mb-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span className="flex-1">{state.error}</span>
              <button
                type="button"
                aria-label="关闭提示"
                onClick={() => dispatch({ kind: 'submitFailure', error: '' })}
                className="shrink-0 text-rose-500"
              >
                <X size={13} />
              </button>
            </div>
          )}
        </div>

        {/* 中部滚动区：分类紧贴顶栏，不额外留白。 */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div
            className={cn(
              'flex items-center justify-between px-4 pb-1 pt-2.5',
              categoryError && 'bg-rose-50',
            )}
          >
            <span
              className={cn(
                'text-[11px] font-semibold',
                categoryError ? 'text-rose-600' : 'text-text-muted',
              )}
            >
              {categoryError ? '请选择分类' : state.type === 'EXPENSE' ? '选择支出分类' : '选择收入分类'}
            </span>
            {categoryPath && (
              <span className="truncate pl-2 text-[11px] text-primary">已选：{categoryPath}</span>
            )}
          </div>

          <CategoryGrid
            nodes={categoryNodes}
            selectedId={state.categoryId}
            onSelect={(categoryId) => {
              setCategoryError(false);
              dispatch({ kind: 'setCategory', categoryId });
            }}
            isLoading={categoriesQuery.isPending && !categoriesQuery.data}
            errorMessage={
              categoriesQuery.isError && !categoriesQuery.data ? '分类加载失败' : null
            }
            onRetry={() => void categoriesQuery.refetch()}
          />
        </div>

        {/*
          底部固定区：快捷条 + 金额卡 + 键盘。
          快捷条与金额卡属于同一个视觉块，键盘永远贴底，中间分类区独立滚动。
        */}
        <div className="shrink-0 border-t border-app-divider bg-app-card">
          <div className="mx-3 mt-2 rounded-2xl bg-app-card-subtle/70 px-3 pb-1.5 pt-2">
            <SheetQuickChips
              accountName={accountName}
              onOpenAccountPicker={() => setAccountPickerOpen(true)}
            />
            <div className="flex items-baseline justify-end gap-2">
              {amount.cents === null && !state.amountText.endsWith('.') && (
                <span className="text-[11px] text-text-tertiary">请输入金额</span>
              )}
              {!isOnline && <span className="text-[11px] text-rose-500">当前离线，无法记账</span>}
              <span className="font-mono text-[26px] font-bold leading-tight text-text-main">
                ¥{amountDisplay}
              </span>
            </div>

            <div className="mt-1 border-t border-app-divider pt-1.5">
              <SheetMetaFields
                occurredAtInput={toLocalInputValue(state.occurredAt)}
                occurredAtLabel={formatBillTime(state.occurredAt)}
                title={state.title}
                note={state.note}
                noteMaxLength={NOTE_MAX_LENGTH}
                onOccurredAtChange={handleTimeChange}
                onTitleChange={(title) => dispatch({ kind: 'setTitle', title })}
                onNoteChange={(note) => dispatch({ kind: 'setNote', note })}
                timeError={state.timeError}
              />
            </div>
          </div>

          <div className="px-3 pb-[calc(0.4rem+env(safe-area-inset-bottom))] pt-1.5">
            <AmountKeypad
              value={state.amountText}
              onChange={(amountText) => dispatch({ kind: 'setAmount', amountText })}
              onSubmit={() => void submit(false)}
              onSecondarySubmit={() => void submit(true)}
              submitText="完成"
              secondarySubmitText="保存再记"
              isSubmitting={state.submitting}
              submitDisabled={submitBlocked}
              insetSafeArea={false}
              compact
            />
          </div>
        </div>
      </BottomSheet>

      <AccountPickerSheet
        open={accountPickerOpen}
        onOpenChange={setAccountPickerOpen}
        accounts={accounts}
        selectedId={state.accountId}
        onSelect={(accountId) => dispatch({ kind: 'setAccount', accountId })}
      />

      <BottomSheet open={confirmDiscard} onOpenChange={setConfirmDiscard} title="放弃本次记账吗">
        <div className="space-y-3 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <p className="text-sm text-text-muted">已填写的内容不会保存。</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConfirmDiscard(false)}
              className="rounded-2xl border border-app-border py-2.5 text-sm text-text-main"
            >
              继续填写
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmDiscard(false);
                onOpenChange(false);
              }}
              className="rounded-2xl bg-rose-500 py-2.5 text-sm font-semibold text-white"
            >
              放弃
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}

/** 把 ISO 字符串转换为 datetime-local 需要的 `YYYY-MM-DDTHH:mm`（设备本地时区）。 */
function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number): string => value.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
