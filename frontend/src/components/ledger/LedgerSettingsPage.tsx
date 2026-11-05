'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError } from '@/lib/api/errors';
import {
  copyLedger,
  deleteLedger,
  getLedger,
  getLedgers,
  updateLedger,
} from '@/lib/api/ledger-api';
import type { LedgerSummary } from '@/lib/api/ledger-types';
import { getTransactions } from '@/lib/api/transaction-api';
import {
  canManageLedger,
  currencyEditable,
  currencyLabel,
  deleteBlockers,
  roleLabel,
  type LedgerAction,
} from '@/lib/ledger/ledger-manage';
import { queryKeys, queryStaleTime } from '@/lib/query/query-config';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { CurrencySheet } from '@/components/ledger/CurrencySheet';
import { DeleteLedgerConfirm } from '@/components/ledger/DeleteLedgerConfirm';
import { EditLedgerSheet } from '@/components/ledger/EditLedgerSheet';
import { LedgerSettingsView } from '@/components/ledger/LedgerSettingsView';
import type { LedgerSettingsItem } from '@/components/ledger/LedgerSettingsList';

/** 删除失败的错误码 → 人话。服务端是唯一裁判，这里只负责解释。 */
const DELETE_ERROR_TEXT: Record<number, string> = {
  40911: '账本内有账单，不能删除',
  40912: '账本还有其他成员，请先移除',
  40913: '账本还有待处理邀请，请先撤销',
  40914: '这是你的最后一本账本，请先新建或加入其他账本',
  40902: '账本状态已变化，请刷新页面后重试',
};

/** 资料修改的 40902 是「版本过期」，含义与删除冲突不同，必须分开提示。 */
const UPDATE_ERROR_TEXT: Record<number, string> = {
  40902: '账本资料已被修改，请查看最新内容',
};

function errorText(error: unknown, overrides: Record<number, string> = {}): string | null {
  if (!error) return null;
  if (error instanceof ApiRequestError) {
    return overrides[error.code] ?? DELETE_ERROR_TEXT[error.code] ?? error.message;
  }
  return '操作失败，请稍后重试';
}

function newClientRequestId(): string {
  return crypto.randomUUID();
}

export function LedgerSettingsPage(): React.JSX.Element {
  const params = useParams<{ ledgerId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentLedgerId = useWorkspaceStore((state) => state.currentLedgerId);
  const ledgerId = params.ledgerId;

  const [editOpen, setEditOpen] = React.useState(false);
  const [currencyOpen, setCurrencyOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const copyRequestId = React.useRef(newClientRequestId());

  const ledgerQuery = useQuery({
    queryKey: queryKeys.ledgers.detail(ledgerId),
    queryFn: () => getLedger(ledgerId),
    staleTime: queryStaleTime.ledgers,
    enabled: Boolean(ledgerId),
  });

  /**
   * 币种是否锁定取决于「账本里有没有账单」。
   * 摘要里没有账单计数，只能取一页的总数；pageSize=1 让这个判断几乎零成本。
   */
  const transactionsQuery = useQuery({
    queryKey: queryKeys.transactions.list(ledgerId, { pageSize: 1 }),
    queryFn: () => getTransactions(ledgerId, { pageSize: 1 }),
    staleTime: queryStaleTime.transactions,
    enabled: Boolean(ledgerId),
  });

  const ledgerCountQuery = useQuery({
    queryKey: queryKeys.ledgers.list(),
    queryFn: () => getLedgers(),
    staleTime: queryStaleTime.ledgers,
    enabled: Boolean(ledgerId),
  });

  // 直接由查询结果推导，不落 state：多一份副本只会在删除/新建后不同步。
  const ledgerCount = ledgerCountQuery.data?.total ?? 1;

  const ledger = ledgerQuery.data ?? null;
  const hasTransactions = (transactionsQuery.data?.total ?? 0) > 0;
  const isOwner = ledger ? canManageLedger(ledger) : false;

  const invalidateAfterWrite = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.ledgers.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.ledgers.detail(ledgerId) }),
    ]);
  };

  const updateMutation = useMutation({
    mutationFn: (input: { name?: string; timezone?: string; defaultCurrency?: string }) => {
      if (!ledger) return Promise.reject(new Error('账本未加载'));
      return updateLedger(ledger.id, { ...input, updatedAt: ledger.updatedAt });
    },
    onSuccess: async () => {
      setEditOpen(false);
      setCurrencyOpen(false);
      await invalidateAfterWrite();
    },
    onError: (error) => {
      // 并发冲突：本地 `updatedAt` 已过期，必须先用服务端最新值刷新再让用户重试。
      if (error instanceof ApiRequestError && error.code === 40902) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.ledgers.detail(ledgerId) });
      }
    },
  });

  const copyMutation = useMutation({
    mutationFn: () => {
      if (!ledger) return Promise.reject(new Error('账本未加载'));
      return copyLedger(ledger.id, {
        name: `${ledger.name}（副本）`,
        type: ledger.type,
        clientRequestId: copyRequestId.current,
      });
    },
    onSuccess: async () => {
      copyRequestId.current = newClientRequestId();
      await queryClient.invalidateQueries({ queryKey: queryKeys.ledgers.all });
      router.push('/user/ledgers');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!ledger) return Promise.reject(new Error('账本未加载'));
      return deleteLedger(ledger.id);
    },
    onSuccess: async () => {
      setDeleteOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.ledgers.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ledgerPreferences }),
      ]);
      // 删掉的可能是当前账本：缓存里它的账单/统计也要一并清掉。
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] === 'ledger' && query.queryKey[1] === ledgerId,
      });
      router.replace('/user/ledgers');
    },
  });

  /**
   * 删除阻碍：成员数与账本数是前端可判断的，是否含账单也能用一页的 total 判断出来。
   * 待处理邀请可由成员页读取；这里仍把服务端 40913 作为删除资格的最终判断。
   */
  const blockers = React.useMemo(() => {
    if (!ledger) return [];
    const known = deleteBlockers(ledger, { ledgerCount });
    return hasTransactions ? ['账本内有账单，不能删除', ...known] : known;
  }, [ledger, ledgerCount, hasTransactions]);

  const groups = React.useMemo(() => {
    if (!ledger) return [];
    const currency = currencyLabel(ledger.defaultCurrency);
    const items: { title: string; items: LedgerSettingsItem[] }[] = [
      {
        title: '资料',
        items: [
          isOwner
            ? {
                key: 'edit',
                label: '编辑账本',
                description: '名称与时区',
                onClick: () => setEditOpen(true),
              }
            : { key: 'type', label: '账本类型', value: ledger.type === 'PERSONAL' ? '个人账本' : '共享账本' },
          { key: 'timezone', label: '账本时区', value: ledger.timezone },
          { key: 'role', label: '我的角色', value: roleLabel(ledger.memberRole) },
        ],
      },
    ];

    if (ledger.type === 'SHARED') {
      items.push({
        title: '协作',
        items: [
          {
            key: 'members',
            label: '成员与邀请',
            value: `${ledger.memberCount} 位成员`,
            onClick: () => router.push(`/user/ledgers/${encodeURIComponent(ledger.id)}/members`),
          },
        ],
      });
    }

    items.push({
      title: '财务',
      items: [
        isOwner
          ? {
              key: 'currency',
              label: '账本币种',
              value: currency,
              onClick: () => setCurrencyOpen(true),
            }
          : { key: 'currency', label: '账本币种', value: currency },
      ],
    });

    if (isOwner) {
      items.push({
        title: '危险操作',
        items: [
          {
            key: 'copy',
            label: '复制账本',
            description: '复制设置与分类，不含账单',
            ...(copyMutation.isPending ? {} : { onClick: () => copyMutation.mutate() }),
          },
          {
            key: 'delete',
            label: '删除账本',
            danger: true,
            ...(blockers.length > 0
              ? { disabledReason: blockers.join('；') }
              : { onClick: () => setDeleteOpen(true) }),
          },
        ],
      });
    }

    return items;
  }, [ledger, isOwner, blockers, copyMutation, router]);

  const state: 'loading' | 'error' | 'ready' = ledgerQuery.isPending && !ledgerQuery.data
    ? 'loading'
    : ledgerQuery.isError && !ledgerQuery.data
      ? 'error'
      : 'ready';

  const handleDeleteConfirm = (): void => {
    if (hasTransactions) return;
    deleteMutation.mutate();
  };

  return (
    <>
      <LedgerSettingsView
        state={state}
        ledger={ledger}
        memberCount={ledger?.memberCount ?? 1}
        groups={groups}
        errorMessage={errorText(ledgerQuery.error)}
        onRetry={() => void ledgerQuery.refetch()}
        readonlyNotice={
          ledger && !isOwner
            ? `你在此账本中的角色为「${roleLabel(ledger.memberRole)}」，仅可查看基本信息。`
            : null
        }
      />

      {ledger && (
        <EditLedgerSheet
          open={editOpen}
          onOpenChange={(open) => {
            setEditOpen(open);
            if (!open) updateMutation.reset();
          }}
          initial={{
            name: ledger.name,
            timezone: ledger.timezone,
            type: ledger.type,
            defaultCurrency: ledger.defaultCurrency,
            memberRole: ledger.memberRole,
          }}
          isSubmitting={updateMutation.isPending}
          error={errorText(updateMutation.error, UPDATE_ERROR_TEXT)}
          onSubmit={(value) => updateMutation.mutate(value)}
        />
      )}

      {ledger && (
        <CurrencySheet
          open={currencyOpen}
          onOpenChange={(open) => {
            setCurrencyOpen(open);
            if (!open) updateMutation.reset();
          }}
          current={ledger.defaultCurrency}
          editable={currencyEditable(ledger, hasTransactions)}
          lockedReason={
            hasTransactions
              ? '账本已有账单，币种不可修改'
              : '只有账本所有者可以修改币种'
          }
          isSubmitting={updateMutation.isPending}
          error={errorText(updateMutation.error, UPDATE_ERROR_TEXT)}
          onSubmit={(currency) => updateMutation.mutate({ defaultCurrency: currency })}
        />
      )}

      <DeleteLedgerConfirm
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) deleteMutation.reset();
        }}
        ledgerName={ledger?.name ?? ''}
        isDeleting={deleteMutation.isPending}
        error={errorText(deleteMutation.error)}
        blockers={blockers}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
