'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError } from '@/lib/api/errors';
import type { TransactionAttachmentSummary } from '@/lib/api/attachment-types';
import { deleteAttachment, getAttachmentAccessUrl } from '@/lib/api/attachment-api';
import {
  deleteTransaction,
  getTransaction,
  updateTransaction,
} from '@/lib/api/transaction-api';
import { getNoteSuggestions } from '@/lib/api/note-api';
import type { TransactionSummary } from '@/lib/api/transaction-types';
import { getLedgerMembers } from '@/lib/api/member-api';
import { getCategories } from '@/lib/api/category-api';
import { getAccounts } from '@/lib/api/account-api';
import { queryKeys, queryStaleTime } from '@/lib/query/query-config';
import { formatBillDateTime } from '@/lib/bill/timezone';
import {
  buildMemberDirectory,
  resolveDetailPermissions,
  toBillDetailView,
} from '@/lib/bill/bill-detail';
import {
  billFormFromTransaction,
  billFormReducer,
  type BillFormState,
} from '@/lib/bill/bill-form';
import { buildCategoryTree } from '@/lib/bill/category-tree';
import { parseAmountText } from '@/lib/bill/amount';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useOfflineStore } from '@/store/offlineStore';
import { useUserAuthStore } from '@/store/userAuthStore';
import { BillDetailSheet, BillDeleteConfirm } from './BillDetailSheet';
import { BillFormBody } from './BillFormBody';
import { AccountPickerSheet } from './AccountPickerSheet';
import { SheetTypeSegment } from './SheetTypeSegment';
import { X } from 'lucide-react';

export interface BillDetailContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ledgerId: string;
  billId: string | null;
  memberRole: 'OWNER' | 'EDITOR' | 'VIEWER' | undefined;
  /** 删除成功后回调，用于列表滚动/提示 */
  onDeleted?: () => void;
}

/**
 * 账单详情的状态容器。
 *
 * 只读态由 `BillDetailSheet` 渲染，编辑态复用记账抽屉的 `BillFormBody`：
 * 两者字段与校验完全一致，另写一套必然分叉。
 */
export function BillDetailContainer({
  open,
  onOpenChange,
  ledgerId,
  billId,
  memberRole,
  onDeleted,
}: BillDetailContainerProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const currentUser = useUserAuthStore((store) => store.currentUser);
  const isOnline = useOfflineStore((store) => store.isOnline);

  const [editing, setEditing] = React.useState(false);
  const [form, dispatch] = React.useReducer(billFormReducer, undefined, () =>
    billFormFromTransaction({
      type: 'EXPENSE',
      amountCents: 0,
      categoryId: null,
      occurredAt: new Date().toISOString(),
      accountId: null,
      title: null,
      note: null,
      payerId: null,
      clientRequestId: crypto.randomUUID(),
    }),
  );
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const noteSuggestionsQuery = useQuery({
    queryKey: queryKeys.transactions.noteSuggestions(ledgerId),
    queryFn: () => getNoteSuggestions(ledgerId, 10),
    staleTime: queryStaleTime.noteSuggestions,
    enabled: open && editing && Boolean(ledgerId),
  });
  const [accountPickerOpen, setAccountPickerOpen] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [conflict, setConflict] = React.useState(false);
  const [categoryError, setCategoryError] = React.useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = React.useState<string | null>(null);
  const [attachmentError, setAttachmentError] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  // 详情不缓存：编辑后必须立刻看到新值。
  const detailQuery = useQuery({
    queryKey: queryKeys.transactions.detail(ledgerId, billId ?? ''),
    queryFn: () => getTransaction(ledgerId, billId ?? ''),
    staleTime: 0,
    enabled: open && Boolean(billId) && Boolean(ledgerId),
  });

  const membersQuery = useQuery({
    queryKey: queryKeys.members(ledgerId),
    queryFn: () => getLedgerMembers(ledgerId),
    staleTime: queryStaleTime.members,
    enabled: open && Boolean(ledgerId),
  });

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(ledgerId),
    queryFn: () => getCategories(ledgerId, { pageSize: 100 }),
    staleTime: queryStaleTime.categories,
    enabled: open && editing,
  });

  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts(ledgerId),
    queryFn: () => getAccounts(ledgerId, { pageSize: 100 }),
    staleTime: queryStaleTime.accounts,
    enabled: open && editing,
  });

  const bill = detailQuery.data;
  const attachments = bill?.attachments ?? [];
  const directory = React.useMemo(
    () => buildMemberDirectory(membersQuery.data?.items ?? []),
    [membersQuery.data],
  );
  const view = React.useMemo(
    () => (bill ? toBillDetailView(bill, directory, formatBillDateTime) : null),
    [bill, directory],
  );

  const permissions = React.useMemo(
    () =>
      bill
        ? resolveDetailPermissions(memberRole, bill, currentUser?.id ?? null)
        : { canEdit: false, canDelete: false },
    [bill, memberRole, currentUser],
  );

  const categories = categoriesQuery.data?.items;
  const categoryNodes = React.useMemo(
    () => buildCategoryTree((categories ?? []).filter((item) => item.type === form.type)),
    [categories, form.type],
  );
  const accounts = accountsQuery.data?.items ?? [];

  // 进入编辑态时用详情预填表单；关闭详情时退出编辑并清掉冲突提示。
  const [wasOpen, setWasOpen] = React.useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {
      setEditing(false);
      setConflict(false);
      setDeleteError(null);
      setCategoryError(false);
    }
  }

  const startEdit = (): void => {
    if (!bill) return;
    // 直接灌入一次完整状态：reset 只能带少数字段，无法预填金额/商家/备注。
    dispatch({ kind: 'hydrate', state: billFormFromTransaction(bill) });
    setConflict(false);
    setCategoryError(false);
    setEditing(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!bill) throw new Error('账单不存在');
      return updateTransaction(ledgerId, bill.id, {
        version: bill.version,
        type: form.type,
        amountCents: parseAmountText(form.amountText).cents ?? 0,
        occurredAt: form.occurredAt,
        categoryId: form.categoryId ?? undefined,
        accountId: form.accountId,
        payerId: form.payerId,
        title: form.title.trim() || null,
        note: form.note.trim() || null,
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      if (!bill) throw new Error('账单不存在');
      return deleteTransaction(ledgerId, bill.id, bill.version);
    },
  });

  const submitEdit = async (): Promise<void> => {
    if (form.submitting) return;
    const amount = parseAmountText(form.amountText);

    if (form.categoryId === null) {
      setCategoryError(true);
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      dispatch({ kind: 'submitFailure', error: '请选择分类' });
      return;
    }
    if (amount.cents === null) {
      dispatch({ kind: 'submitFailure', error: amount.error ?? '请输入金额' });
      return;
    }
    if (form.timeError) {
      dispatch({ kind: 'submitFailure', error: form.timeError });
      return;
    }

    dispatch({ kind: 'submitStart' });
    try {
      await saveMutation.mutateAsync();
      await queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all(ledgerId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.transactions.noteSuggestions(ledgerId) });
      await queryClient.invalidateQueries({ queryKey: ['ledger', ledgerId, 'statistics'] });
      await detailQuery.refetch();
      setEditing(false);
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === 40922) {
        setConflict(true);
        setEditing(false);
        return;
      }
      const message =
        error instanceof ApiRequestError && error.code === 40321
          ? '当前成员没有编辑该账单的权限'
          : error instanceof ApiRequestError
            ? error.message
            : '保存失败，请检查网络后重试';
      dispatch({ kind: 'submitFailure', error: message });
    }
  };

  const confirmDelete = async (): Promise<void> => {
    setDeleteError(null);
    try {
      await removeMutation.mutateAsync();
      await queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all(ledgerId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.transactions.noteSuggestions(ledgerId) });
      await queryClient.invalidateQueries({ queryKey: ['ledger', ledgerId, 'statistics'] });
      setDeleteOpen(false);
      onOpenChange(false);
      onDeleted?.();
    } catch (error) {
      const message =
        error instanceof ApiRequestError && error.code === 40922
          ? '账单已被其他人修改，请刷新后重试'
          : error instanceof ApiRequestError && error.code === 40321
            ? '当前成员没有删除该账单的权限'
            : error instanceof ApiRequestError
              ? error.message
              : '删除失败，请检查网络后重试';
      setDeleteError(message);
    }
  };

  const refreshAttachmentUrl = async (attachmentId: string): Promise<string> => {
    const result = await getAttachmentAccessUrl(ledgerId, attachmentId);
    queryClient.setQueryData<TransactionSummary>(queryKeys.transactions.detail(ledgerId, billId ?? ''), (current) => {
      if (!current) return current;
      return {
        ...current,
        attachments: current.attachments?.map((attachment) => (
          attachment.id === attachmentId
            ? {
                ...attachment,
                accessUrl: result.accessUrl,
                accessUrlExpiresAt: result.accessUrlExpiresAt,
              }
            : attachment
        )),
      };
    });
    return result.accessUrl;
  };

  const removeAttachment = async (attachment: TransactionAttachmentSummary): Promise<void> => {
    if (!window.confirm('确定移除这张图片吗？')) return;
    setAttachmentError(null);
    setDeletingAttachmentId(attachment.id);
    try {
      await deleteAttachment(ledgerId, bill?.id ?? '', attachment.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.transactions.detail(ledgerId, billId ?? '') });
      await queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all(ledgerId) });
    } catch (error) {
      setAttachmentError(
        error instanceof ApiRequestError ? error.message : '图片移除失败，请稍后重试',
      );
    } finally {
      setDeletingAttachmentId(null);
    }
  };

  const errorMessage =
    detailQuery.isError && !detailQuery.data
      ? detailQuery.error instanceof ApiRequestError
        ? detailQuery.error.code === 40421
          ? '账单不存在或已被删除'
          : detailQuery.error.message
        : '账单加载失败，请稍后重试'
      : null;

  return (
    <>
      <BillDetailSheet
        open={open && !editing}
        onOpenChange={onOpenChange}
        isLoading={detailQuery.isLoading}
        errorMessage={errorMessage}
        view={view}
        conflict={conflict}
        canEdit={permissions.canEdit}
        canDelete={permissions.canDelete}
        onEdit={startEdit}
        onDelete={() => {
          setDeleteError(null);
          setDeleteOpen(true);
        }}
        onReload={() => {
          setConflict(false);
          void detailQuery.refetch();
        }}
        onRetry={() => void detailQuery.refetch()}
        attachments={attachments}
        deletingAttachmentId={deletingAttachmentId}
        onDeleteAttachment={(attachment) => void removeAttachment(attachment)}
        onRefreshAttachmentUrl={refreshAttachmentUrl}
      />

      {attachmentError && open && !editing && (
        <p role="alert" className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-rose-600 px-4 py-2 text-xs text-white shadow-lg">
          {attachmentError}
        </p>
      )}

      <BottomSheet
        open={open && editing}
        onOpenChange={(next) => {
          if (!next) setEditing(false);
        }}
        variant="full"
        onBeforeClose={() => {
          if (form.isDirty && !form.submitting) {
            setEditing(false);
            return false;
          }
          return true;
        }}
      >
        <div className="shrink-0">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pt-3">
            <button
              type="button"
              aria-label="退出编辑"
              onClick={() => setEditing(false)}
              className="flex size-9 shrink-0 items-center justify-center justify-self-start rounded-full bg-app-card-subtle text-text-muted active:scale-95"
            >
              <X size={18} />
            </button>
            <SheetTypeSegment
              value={form.type}
              onChange={(type) => dispatch({ kind: 'setType', type })}
            />
            <span className="min-w-0 justify-self-end truncate text-right text-xs text-text-muted">
              编辑账单
            </span>
          </div>
          {form.error && (
            <p className="mx-4 mb-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {form.error}
            </p>
          )}
        </div>

        <BillFormBody
          state={form}
          dispatch={dispatch}
          categoryNodes={categoryNodes}
          categories={categories ?? []}
          categoriesLoading={categoriesQuery.isPending && !categoriesQuery.data}
          categoriesError={categoriesQuery.isError && !categoriesQuery.data ? '分类加载失败' : null}
          onRetryCategories={() => void categoriesQuery.refetch()}
          categoryError={categoryError}
          onSelectCategory={(categoryId) => {
            setCategoryError(false);
            dispatch({ kind: 'setCategory', categoryId });
          }}
          accounts={accounts}
          onOpenAccountPicker={() => setAccountPickerOpen(true)}
          isOnline={isOnline}
          scrollRef={scrollRef}
          primaryText="保存"
          onSubmit={() => void submitEdit()}
          noteSuggestions={noteSuggestionsQuery.data?.items ?? []}
          submitDisabled={
            parseAmountText(form.amountText).cents === null || Boolean(form.timeError) || !isOnline
          }
        />
      </BottomSheet>

      <AccountPickerSheet
        open={accountPickerOpen}
        onOpenChange={setAccountPickerOpen}
        accounts={accounts}
        selectedId={form.accountId}
        onSelect={(accountId) => dispatch({ kind: 'setAccount', accountId })}
      />

      <BillDeleteConfirm
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        amountText={view?.signedAmount ?? ''}
        typeLabel={view?.isExpense ? '支出' : '收入'}
        dateText={bill ? formatBillDateTime(bill.occurredAt) : ''}
        submitting={removeMutation.isPending}
        errorMessage={deleteError}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
