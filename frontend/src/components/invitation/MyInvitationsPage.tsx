'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError } from '@/lib/api/errors';
import {
  acceptInvitation,
  declineInvitation,
  getMyInvitations,
} from '@/lib/api/invitation-api';
import { queryKeys, queryStaleTime } from '@/lib/query/query-config';
import { MyInvitationsView, type MyInvitationItem } from '@/components/invitation/MyInvitationsView';

function errorText(error: unknown, fallback = '操作失败，请稍后重试'): string | null {
  if (!error) return null;
  if (error instanceof ApiRequestError) return error.message;
  return fallback;
}

export function MyInvitationsPage(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const token = searchParams.get('token')?.trim() ?? '';
  // 接受与拒绝共用一个 token；用 `action=decline` 区分，避免同一张卡上放两个不可分辨的主按钮。
  const mode = searchParams.get('action') === 'decline' ? 'decline' : 'accept';

  const invitationsQuery = useQuery({
    queryKey: queryKeys.invitations,
    queryFn: getMyInvitations,
    staleTime: queryStaleTime.invitations,
  });

  /**
   * 接受邀请后账本列表与偏好都变了：不刷新会出现「已加入但我的账本里没有」。
   * 同时把当前账本切到新账本由服务端偏好决定，这里只做失效。
   */
  const refreshAfterAccept = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.invitations }),
      queryClient.invalidateQueries({ queryKey: queryKeys.ledgers.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.ledgerPreferences }),
    ]);
  };

  const acceptMutation = useMutation({
    mutationFn: (inviteToken: string) => acceptInvitation(inviteToken),
    onSuccess: async () => {
      await refreshAfterAccept();
      router.replace('/user');
    },
  });

  const declineMutation = useMutation({
    mutationFn: (inviteToken: string) => declineInvitation(inviteToken),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitations });
      router.replace('/user/invitations');
    },
  });

  const goDecline = (): void => {
    router.replace(`/user/invitations?action=decline&token=${encodeURIComponent(token)}`);
  };

  const items: MyInvitationItem[] = (invitationsQuery.data ?? []).map((invitation) => ({
    id: invitation.id,
    ledgerName: invitation.ledger?.name ?? '未知账本',
    ledgerType: invitation.ledger?.type ?? 'PERSONAL',
    role: invitation.role,
    expiresAt: invitation.expiresAt,
  }));

  const state: 'loading' | 'error' | 'empty' | 'ready' =
    invitationsQuery.isPending && !invitationsQuery.data
      ? 'loading'
      : invitationsQuery.isError && !invitationsQuery.data
        ? 'error'
        : items.length === 0
          ? 'empty'
          : 'ready';

  const pendingError = errorText(acceptMutation.error) ?? errorText(declineMutation.error);

  return (
    <MyInvitationsView
      state={state}
      items={items}
      errorMessage={errorText(invitationsQuery.error)}
      onRetry={() => void invitationsQuery.refetch()}
      tokenPrompt={
        token
          ? {
              token,
              mode,
              isSubmitting: acceptMutation.isPending || declineMutation.isPending,
              error: pendingError,
              onSubmit: (submitted) => {
                if (mode === 'decline') declineMutation.mutate(submitted);
                else acceptMutation.mutate(submitted);
              },
              onSwitchMode: mode === 'accept' ? goDecline : undefined,
            }
          : null
      }
    />
  );
}
