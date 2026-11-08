'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { AccountSummary } from '@/lib/api/account-types';
import type { NoteSuggestion } from '@/lib/api/transaction-types';
import { amountTextFromCents, parseAmountText } from '@/lib/bill/amount';
import { categoryPathText, type CategoryNode } from '@/lib/bill/category-tree';
import { formatBillTime } from '@/lib/bill/bill-group';
import { zonedDateTimeInputToIso, zonedInputValue } from '@/lib/bill/timezone';
import { NOTE_MAX_LENGTH, type BillFormAction, type BillFormState } from '@/lib/bill/bill-form';
import { AmountKeypad } from '@/components/mobile/AmountKeypad';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { CategoryGrid } from './CategoryGrid';
import { CategoryEditorSheet } from './CategoryEditorSheet';
import { CategoryManageBody } from './CategoryManageSheet';
import type { CategorySummary, CategoryType } from '@/lib/api/category-types';
import { SheetMetaFields } from './SheetMetaFields';
import { useVisualViewport } from '@/lib/viewport/use-visual-viewport';
import { SheetQuickChips } from './SheetQuickChips';

export interface BillFormBodyProps {
  state: BillFormState;
  dispatch: React.Dispatch<BillFormAction>;
  /** 分类树（已按当前类型过滤） */
  categoryNodes: readonly CategoryNode[];
  /** 用于把 categoryId 还原成「一级-二级」文案 */
  categories: readonly CategorySummary[];
  categoriesLoading: boolean;
  categoriesError: string | null;
  onRetryCategories: () => void;
  categoryError: boolean;
  onSelectCategory: (categoryId: string) => void;
  accounts: readonly AccountSummary[];
  onOpenAccountPicker: () => void;
  isOnline: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** 主提交键文案，如「完成」/「保存」 */
  primaryText: string;
  /** 副提交键文案；不传则不渲染副键 */
  secondaryText?: string;
  onSubmit: () => void;
  onSecondarySubmit?: () => void;
  submitDisabled: boolean;
  /** 分类管理（OWNER）：传 session 才渲染「＋」与「管理」 */
  categoryManage?: CategoryManageSession;
  noteSuggestions?: readonly NoteSuggestion[];
}

export interface CategoryManageSession {
  ledgerId: string;
  type: CategoryType;
  canManage: boolean;
  /** 含停用的全量分类，用于管理列表 */
  allCategories: readonly CategorySummary[];
  isLoadingAll: boolean;
  showInactive: boolean;
  onToggleInactive: () => void;
  /** 保存后由调用方失效缓存并刷新 */
  onChanged: () => void;
}

/**
 * 记账表单的主体：分类滚动区 + 底部金额卡与键盘。
 *
 * 新建抽屉和详情编辑态共用同一套字段与校验，差别只在顶栏和提交动作；
 * 因此这里不收 `open`、不收提交逻辑，只收已算好的展示数据与回调。
 */
export function BillFormBody({
  state,
  dispatch,
  categoryNodes,
  categories,
  categoriesLoading,
  categoriesError,
  onRetryCategories,
  categoryError,
  onSelectCategory,
  accounts,
  onOpenAccountPicker,
  isOnline,
  scrollRef,
  primaryText,
  secondaryText,
  onSubmit,
  onSecondarySubmit,
  submitDisabled,
  categoryManage,
  noteSuggestions = [],
}: BillFormBodyProps): React.JSX.Element {
  /**
   * 键盘覆盖模型：系统键盘不改变面板高度，只把底部固定区整体抬到键盘上缘。
   * 抬起来的是「快捷条 + 金额卡」，数字键盘此时已被键盘覆盖，不再参与布局。
   */
  const { keyboardInset, isKeyboardOpen } = useVisualViewport();
  /**
   * 底部区抬升量在「开始编辑文本」时测一次并冻结，失焦立刻归零。
   *
   * 不再持续跟随 visualViewport：键盘动画期间高度会连续变化，逐帧改 margin
   * 会让面板反复重排，既可能把键盘顶回去，也会把中间滚动区压到 0 高（表现为账单页不能滚）。
   * 测量只发生在事件里，并在 600ms 内取最大值，避免首帧读到键盘尚未弹出的 0。
   */
  const [liftInset, setLiftInset] = React.useState(0);
  const liftTimerRef = React.useRef<number | null>(null);

  const stopLift = React.useCallback((): void => {
    if (liftTimerRef.current !== null) {
      window.clearInterval(liftTimerRef.current);
      liftTimerRef.current = null;
    }
    setLiftInset(0);
  }, []);

  const handleEditingChange = React.useCallback((editing: boolean): void => {
    if (!editing) {
      stopLift();
      return;
    }
    if (liftTimerRef.current !== null) return;

    const viewport = window.visualViewport;
    if (!viewport) return;

    let watched = 0;
    let peak = 0;
    // 键盘是异步弹出的，轮询一段时间取峰值；上限 50% 屏高，避免极端值把布局压塌。
    liftTimerRef.current = window.setInterval(() => {
      watched += 60;
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      if (inset > 120) peak = Math.max(peak, inset);
      const settled = inset > 120 && peak > 0 && inset <= peak;
      if (watched >= 600 || (settled && watched >= 240)) {
        if (liftTimerRef.current !== null) {
          window.clearInterval(liftTimerRef.current);
          liftTimerRef.current = null;
        }
        setLiftInset(Math.min(peak, Math.round(window.innerHeight * 0.5)));
      }
    }, 60);
  }, [stopLift]);

  React.useEffect(() => () => stopLift(), [stopLift]);

  const shouldLiftForKeyboard = liftInset > 0 && isKeyboardOpen;
  const [manageOpen, setManageOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CategorySummary | null>(null);
  const [editorOpen, setEditorOpen] = React.useState(false);

  const openCreate = (): void => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openEdit = (category: CategorySummary): void => {
    setEditing(category);
    setEditorOpen(true);
  };

  const parentNodes = React.useMemo(() => categoryNodes.map((node) => ({ id: node.id, name: node.name })), [categoryNodes]);
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

  const categoryPath = categoryPathText(categories, state.categoryId);
  const accountName = accounts.find((account) => account.id === state.accountId)?.name ?? null;

  const handleTimeChange = (value: string): void => {
    const occurredAt = zonedDateTimeInputToIso(value);
    if (!occurredAt) return;
    dispatch({
      kind: 'setOccurredAt',
      occurredAt,
      timeError: new Date(occurredAt).getTime() > Date.now() ? '不能记未来的账' : null,
    });
  };

  return (
    <>
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
          <div className="flex min-w-0 items-center gap-2">
            {categoryPath && (
              <span className="truncate text-[11px] text-primary">已选：{categoryPath}</span>
            )}
            {categoryManage?.canManage && (
              <button
                type="button"
                onClick={() => setManageOpen(true)}
                className="shrink-0 rounded-full border border-app-border px-2 py-0.5 text-[11px] text-text-muted active:scale-95"
              >
                管理
              </button>
            )}
          </div>
        </div>

        <CategoryGrid
          nodes={categoryNodes}
          selectedId={state.categoryId}
          onSelect={onSelectCategory}
          isLoading={categoriesLoading}
          errorMessage={categoriesError}
          onRetry={onRetryCategories}
          canManage={categoryManage?.canManage ?? false}
          onCreate={openCreate}
        />
      </div>

      {/*
        底部固定区：快捷条 + 金额卡 + 键盘。
        快捷条与金额卡属于同一个视觉块，键盘永远贴底，中间分类区独立滚动。
      */}
      <div
        className="shrink-0 border-t border-app-divider bg-app-card"
        style={shouldLiftForKeyboard ? { marginBottom: liftInset } : undefined}
      >
        <div className="mx-3 mt-2 rounded-2xl bg-app-card-subtle/70 px-3 pb-1.5 pt-2">
          <SheetQuickChips accountName={accountName} onOpenAccountPicker={onOpenAccountPicker} />
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
              occurredAtInput={zonedInputValue(state.occurredAt)}
              occurredAtLabel={formatBillTime(state.occurredAt)}
              title={state.title}
              note={state.note}
              noteMaxLength={NOTE_MAX_LENGTH}
              onOccurredAtChange={handleTimeChange}
              onTitleChange={(title) => dispatch({ kind: 'setTitle', title })}
              onNoteChange={(note) => dispatch({ kind: 'setNote', note })}
              timeError={state.timeError}
              suggestions={noteSuggestions}
              onEditingChange={handleEditingChange}
            />
          </div>
        </div>

        {/*
          键盘弹出时数字键盘已被系统键盘覆盖，不再占位；
          但提交动作必须仍可触达，所以换成一条紧凑的保存条，贴在金额卡下方。
        */}
        {shouldLiftForKeyboard ? (
          <div className="flex items-center justify-end gap-2 px-3 pb-2 pt-1">
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitDisabled || state.submitting}
              className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white active:scale-95 disabled:opacity-50"
            >
              {state.submitting ? '保存中…' : primaryText}
            </button>
          </div>
        ) : (
          <div className="px-3 pb-[calc(0.4rem+env(safe-area-inset-bottom))] pt-1.5">
            <AmountKeypad
              value={state.amountText}
              onChange={(amountText) => dispatch({ kind: 'setAmount', amountText })}
              onSubmit={onSubmit}
              onSecondarySubmit={onSecondarySubmit}
              submitText={primaryText}
              secondarySubmitText={secondaryText}
              isSubmitting={state.submitting}
              submitDisabled={submitDisabled}
              insetSafeArea={false}
              compact
            />
          </div>
        )}
      </div>

      {categoryManage && (
        <>
          <BottomSheet
            open={manageOpen}
            onOpenChange={setManageOpen}
            layer="nested"
            title="管理分类"
          >
            <CategoryManageBody
              categories={categoryManage.allCategories}
              isLoading={categoryManage.isLoadingAll}
              showInactive={categoryManage.showInactive}
              onToggleInactive={categoryManage.onToggleInactive}
              onEdit={(category) => {
                openEdit(category);
              }}
              onCreate={openCreate}
            />
            <div className="shrink-0 border-t border-app-divider px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
              <button
                type="button"
                onClick={() => setManageOpen(false)}
                className="w-full rounded-2xl border border-app-border py-2.5 text-sm text-text-main"
              >
                完成
              </button>
            </div>
          </BottomSheet>

          <CategoryEditorSheet
            open={editorOpen}
            onOpenChange={setEditorOpen}
            ledgerId={categoryManage.ledgerId}
            type={categoryManage.type}
            categories={categoryManage.allCategories}
            parentNodes={parentNodes}
            editing={editing}
            onSaved={() => {
              categoryManage.onChanged();
              setManageOpen(false);
            }}
          />
        </>
      )}
    </>
  );
}
