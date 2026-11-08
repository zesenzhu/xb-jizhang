'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError } from '@/lib/api/errors';
import {
  acceptInvitationById,
  declineInvitationById,
  getInvitationByToken,
  getInvitationPreview,
  getMyInvitations,
} from '@/lib/api/invitation-api';
import { queryKeys, queryStaleTime } from '@/lib/query/query-config';
import { MyInvitationsView, PublicInvitationPreview, type MyInvitationItem } from '@/components/invitation/MyInvitationsView';
import { getLoginRedirectUrl, getSafeRedirectTarget } from '@/lib/routing/routes';
import { useUserAuthStore } from '@/store/userAuthStore';

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
  const authStatus = useUserAuthStore((state) => state.status);
  const isAuthenticated = authStatus === 'authenticated';

  const invitationsQuery = useQuery({
    queryKey: queryKeys.invitations,
    queryFn: getMyInvitations,
    staleTime: queryStaleTime.invitations,
    enabled: isAuthenticated,
  });

  const tokenQuery = useQuery({
    queryKey: [...queryKeys.invitations, 'token', token] as const,
    queryFn: () => getInvitationByToken(token),
    staleTime: 0,
    enabled: Boolean(token) && isAuthenticated,
    retry: false,
  });

  const previewQuery = useQuery({
    queryKey: [...queryKeys.invitations, 'preview', token] as const,
    queryFn: () => getInvitationPreview(token),
    staleTime: 0,
    enabled: Boolean(token) && !isAuthenticated,
    retry: false,
  });

  const refreshAfterResponse = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.invitations }),
      queryClient.invalidateQueries({ queryKey: queryKeys.ledgers.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.ledgerPreferences }),
    ]);
  };

  const respondMutation = useMutation({
    mutationFn: async (input: { invitationId: string; action: 'accept' | 'decline' }) =>
      input.action === 'accept'
        ? acceptInvitationById(input.invitationId)
        : declineInvitationById(input.invitationId),
    onSuccess: async (result, input) => {
      await refreshAfterResponse();
      if (input.action === 'accept' && result && 'ledgerId' in result) {
        router.replace(`/user/ledger/${encodeURIComponent(result.ledgerId)}`);
      } else {
        // 拒绝后清掉 URL 上的 token，避免刷新时再次进入已处理邀请。
        router.replace('/user/invitations');
      }
    },
  });

  const items: MyInvitationItem[] = (invitationsQuery.data ?? []).map((invitation) => ({
    id: invitation.id,
    ledgerName: invitation.ledger?.name ?? '未知账本',
    ledgerType: invitation.ledger?.type ?? 'PERSONAL',
    inviterName:
      invitation.inviter?.nickname?.trim() || invitation.inviter?.username || '账本成员',
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

  const tokenState: 'idle' | 'loading' | 'error' | 'ready' = !token
    ? 'idle'
    : tokenQuery.isPending
      ? 'loading'
      : tokenQuery.isError
        ? 'error'
        : tokenQuery.data
          ? 'ready'
          : 'error';

  const tokenDetail = tokenQuery.data ?? null;
  const pendingInvitationId = respondMutation.isPending
    ? respondMutation.variables?.invitationId ?? null
    : null;

  if (!isAuthenticated) {
    const redirectTarget = getSafeRedirectTarget(
      `/user/invitations?token=${encodeURIComponent(token)}`,
      'user',
    );
    const loginUrl = getLoginRedirectUrl('user', '/user/invitations', `?token=${encodeURIComponent(token)}`);
    const registerUrl = `/user/register?redirect=${encodeURIComponent(redirectTarget)}`;
    return (
      <PublicInvitationPreview
        state={
          !token
            ? 'ready'
            : previewQuery.isPending
              ? 'loading'
              : previewQuery.isError
                ? 'error'
                : 'ready'
        }
        preview={previewQuery.data ?? null}
        errorMessage={errorText(previewQuery.error)}
        onRetry={() => void previewQuery.refetch()}
        onLogin={() => router.push(loginUrl)}
        onRegister={() => router.push(registerUrl)}
      />
    );
  }

  return (
    <MyInvitationsView
      state={state}
      items={items}
      errorMessage={errorText(invitationsQuery.error)}
      onRetry={() => void invitationsQuery.refetch()}
      tokenState={tokenState}
      tokenDetail={tokenDetail}
      tokenError={errorText(tokenQuery.error)}
      onTokenRetry={() => void tokenQuery.refetch()}
      onRespond={(invitationId, action) => respondMutation.mutate({ invitationId, action })}
      pendingInvitationId={pendingInvitationId}
      onGoProfile={() => router.push('/user/profile')}
      onGoLedger={(ledgerId) => router.replace(`/user/ledger/${encodeURIComponent(ledgerId)}`)}
    />
  );
}
