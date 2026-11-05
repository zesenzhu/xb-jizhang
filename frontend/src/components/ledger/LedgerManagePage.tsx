'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError } from '@/lib/api/errors';
import { copyLedger, createLedger, deleteLedger, getLedgers } from '@/lib/api/ledger-api';
import type { LedgerSummary } from '@/lib/api/ledger-types';
import {
  buildLedgerGroups,
  canManageLedger,
  deleteBlockers,
  ledgerActions,
  type LedgerAction,
} from '@/lib/ledger/ledger-manage';
import { switchLedger } from '@/lib/ledger/ledger-switch';
import { queryKeys, queryStaleTime } from '@/lib/query/query-config';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { CreateLedgerSheet } from '@/components/ledger/CreateLedgerSheet';
import { DeleteLedgerConfirm } from '@/components/ledger/DeleteLedgerConfirm';
import { LedgerManageView } from '@/components/ledger/LedgerManageView';

/** 复制账本时的幂等键；组件挂载期复用，重试不会建出第二个副本。 */
function newClientRequestId(): string {
  return crypto.randomUUID();
}

function errorText(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiRequestError) return error.message;
  return '操作失败，请稍后重试';
}

export function LedgerManagePage(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const currentLedgerId = useWorkspaceStore((state) => state.currentLedgerId);
  const setCurrentLedgerId = useWorkspaceStore((state) => state.setCurrentLedgerId);

  const [menuLedger, setMenuLedger] = React.useState<LedgerSummary | null>(null);
  const [createOpen, setCreateOpen] = React.useState(() => searchParams.get('create') === '1');
  const [deleteTarget, setDeleteTarget] = React.useState<LedgerSummary | null>(null);
  const [copyTarget, setCopyTarget] = React.useState<LedgerSummary | null>(null);
  const [pendingLedgerId, setPendingLedgerId] = React.useState<string | null>(null);
  const [switchError, setSwitchError] = React.useState<string | null>(null);
  const copyRequestId = React.useRef(newClientRequestId());

  const ledgersQuery = useQuery({
    queryKey: queryKeys.ledgers.list(),
    queryFn: () => getLedgers(),
    staleTime: queryStaleTime.ledgers,
  });

  const ledgers = React.useMemo(() => ledgersQuery.data?.items ?? [], [ledgersQuery.data]);
  const groups = React.useMemo(() => buildLedgerGroups(ledgers), [ledgers]);
  const isLoading = ledgersQuery.isPending && !ledgersQuery.data;
  const loadError =
    ledgersQuery.isError && !ledgersQuery.data
      ? errorText(ledgersQuery.error)
      : null;

  const invalidateLedgers = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: queryKeys.ledgers.all });

  const handleSelect = async (ledger: LedgerSummary): Promise<void> => {
    setSwitchError(null);
    if (ledger.id === currentLedgerId) {
      router.push('/user');
      return;
    }

    setPendingLedgerId(ledger.id);
    try {
      await switchLedger({
        queryClient,
        ledgerId: ledger.id,
        currentLedgerId,
        setCurrentLedgerId,
      });
      router.push('/user');
    } catch (error) {
      // 切换失败必须保留原当前账本，并刷新列表，让界面反映服务端的真实状态。
      setSwitchError(errorText(error) ?? '切换账本失败，请重试');
      await invalidateLedgers();
    } finally {
      setPendingLedgerId(null);
    }
  };

  const createMutation = useMutation({
    mutationFn: (input: { name: string; type: LedgerSummary['type'] }) => createLedger(input),
    onSuccess: async () => {
      setCreateOpen(false);
      await invalidateLedgers();
    },
  });

  const copyMutation = useMutation({
    // 名称与类型由复制面板决定：用户可能想借复制得到一本不同的新账本。
    mutationFn: (input: { ledger: LedgerSummary; name: string; type: LedgerSummary['type'] }) =>
      copyLedger(input.ledger.id, {
        name: input.name,
        type: input.type,
        clientRequestId: copyRequestId.current,
      }),
    onSuccess: async () => {
      setCopyTarget(null);
      copyRequestId.current = newClientRequestId();
      await invalidateLedgers();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (ledger: LedgerSummary) => deleteLedger(ledger.id),
    onSuccess: async () => {
      setDeleteTarget(null);
      await Promise.all([
        invalidateLedgers(),
        queryClient.invalidateQueries({ queryKey: queryKeys.ledgerPreferences }),
      ]);
    },
  });

  const actionsFor = React.useCallback(
    (ledger: LedgerSummary): readonly LedgerAction[] => {
      const blockers = deleteBlockers(ledger, { ledgerCount: ledgers.length });
      return ledgerActions(ledger, {
        canDelete: blockers.length === 0,
        deleteDisabledReason: blockers[0] ?? null,
      });
    },
    [ledgers.length],
  );

  const handleAction = (key: LedgerAction['key']): void => {
    const ledger = menuLedger;
    if (!ledger) return;
    if (key === 'settings') {
      setMenuLedger(null);
      router.push(`/user/ledgers/${encodeURIComponent(ledger.id)}/settings`);
      return;
    }
    if (key === 'copy') {
      setMenuLedger(null);
      copyRequestId.current = newClientRequestId();
      setCopyTarget(ledger);
      return;
    }
    // 只剩删除：设置与复制在上面各自 return 掉了。
    void key;
    setMenuLedger(null);
    deleteMutation.reset();
    setDeleteTarget(ledger);
  };

  const state: 'loading' | 'error' | 'empty' | 'ready' = isLoading
    ? 'loading'
    : loadError
      ? 'error'
      : ledgers.length === 0
        ? 'empty'
        : 'ready';

  return (
    <>
      <LedgerManageView
        state={state}
        groups={groups}
        currentLedgerId={currentLedgerId}
        pendingLedgerId={pendingLedgerId}
        errorMessage={switchError ?? loadError}
        canManage={canManageLedger}
        onRetry={() => void ledgersQuery.refetch()}
        onCreate={() => {
          createMutation.reset();
          setCreateOpen(true);
        }}
        onSelect={(ledger) => void handleSelect(ledger)}
        onOpenMenu={(ledger) => {
          setMenuLedger(ledger);
        }}
        actionsFor={actionsFor}
        menuLedger={menuLedger}
        onMenuOpenChange={(open) => {
          if (!open) setMenuLedger(null);
        }}
        onAction={handleAction}
      />

      <CreateLedgerSheet
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) createMutation.reset();
        }}
        isSubmitting={createMutation.isPending}
        error={errorText(createMutation.error)}
        onSubmit={(input) => createMutation.mutate(input)}
      />

      <CreateLedgerSheet
        open={copyTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCopyTarget(null);
            copyMutation.reset();
          }
        }}
        isSubmitting={copyMutation.isPending}
        error={errorText(copyMutation.error)}
        title="复制账本"
        submitText="复制"
        initialName={copyTarget ? `${copyTarget.name}（副本）` : ''}
        onSubmit={(input) => {
          if (copyTarget) copyMutation.mutate({ ledger: copyTarget, ...input });
        }}
      />

      <DeleteLedgerConfirm
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            deleteMutation.reset();
          }
        }}
        ledgerName={deleteTarget?.name ?? ''}
        isDeleting={deleteMutation.isPending}
        error={errorText(deleteMutation.error)}
        blockers={deleteTarget ? deleteBlockers(deleteTarget, { ledgerCount: ledgers.length }) : []}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget);
        }}
      />
    </>
  );
}
