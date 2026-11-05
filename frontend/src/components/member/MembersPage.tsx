'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError } from '@/lib/api/errors';
import { getLedger } from '@/lib/api/ledger-api';
import {
  getLedgerMembers,
  leaveLedger,
  removeMember,
  transferOwnership,
  updateMemberRole,
} from '@/lib/api/member-api';
import type { LedgerMemberSummary } from '@/lib/api/member-types';
import {
  createInvitation,
  getLedgerInvitations,
  revokeInvitation,
} from '@/lib/api/invitation-api';
import { queryKeys, queryStaleTime } from '@/lib/query/query-config';
import { buildInviteLink, roleLabel } from '@/lib/ledger/ledger-manage';
import {
  selectSessionInvitations,
  useInvitationSessionStore,
} from '@/lib/ledger/invitation-session';
import { useUserAuthStore } from '@/store/userAuthStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { InviteMemberSheet } from '@/components/member/InviteMemberSheet';
import { MemberActionSheet, type MemberAction } from '@/components/member/MemberActionSheet';
import { MembersView } from '@/components/member/MembersView';
import { TransferOwnerSheet } from '@/components/member/TransferOwnerSheet';
import type { PendingInvitation } from '@/components/member/InvitationList';

function errorText(error: unknown, fallback = '操作失败，请稍后重试'): string | null {
  if (!error) return null;
  if (error instanceof ApiRequestError) return error.message;
  return fallback;
}

export function MembersPage(): React.JSX.Element {
  const params = useParams<{ ledgerId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const ledgerId = params.ledgerId;
  const currentUserId = useUserAuthStore((state) => state.currentUser?.id ?? null);
  const currentLedgerId = useWorkspaceStore((state) => state.currentLedgerId);
  const setCurrentLedgerId = useWorkspaceStore((state) => state.setCurrentLedgerId);

  const sessionInvitations = useInvitationSessionStore(selectSessionInvitations(ledgerId));
  const addSessionInvitation = useInvitationSessionStore((state) => state.add);
  const removeSessionInvitation = useInvitationSessionStore((state) => state.remove);

  const [actionMember, setActionMember] = React.useState<LedgerMemberSummary | null>(null);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [inviteResult, setInviteResult] = React.useState<{
    targetEmail: string;
    role: 'EDITOR' | 'VIEWER';
    expiresAt: string;
    inviteLink: string;
  } | null>(null);
  const [pendingMemberId, setPendingMemberId] = React.useState<string | null>(null);
  const [pendingInvitationId, setPendingInvitationId] = React.useState<string | null>(null);

  const ledgerQuery = useQuery({
    queryKey: queryKeys.ledgers.detail(ledgerId),
    queryFn: () => getLedger(ledgerId),
    staleTime: queryStaleTime.ledgers,
    enabled: Boolean(ledgerId),
  });

  const membersQuery = useQuery({
    queryKey: queryKeys.members(ledgerId),
    queryFn: () => getLedgerMembers(ledgerId),
    staleTime: queryStaleTime.members,
    enabled: Boolean(ledgerId),
  });

  const ledger = ledgerQuery.data ?? null;
  const members = React.useMemo(
    () => membersQuery.data?.items ?? [],
    [membersQuery.data],
  );
  const isOwner = ledger?.memberRole === 'OWNER';
  const selfMember = members.find((member) => member.user.id === currentUserId) ?? null;
  const canLeave = Boolean(selfMember && ledger && ledger.type === 'SHARED' && !isOwner);

  const invitationsQuery = useQuery({
    queryKey: queryKeys.ledgerInvitations(ledgerId),
    queryFn: () => getLedgerInvitations(ledgerId),
    staleTime: queryStaleTime.invitations,
    enabled: Boolean(ledgerId && isOwner && ledger?.type === 'SHARED'),
  });

  const refreshMembership = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.members(ledgerId) }),
      // 角色与成员数在账本摘要里，不同步会让「我的账本」显示过期角色。
      queryClient.invalidateQueries({ queryKey: queryKeys.ledgers.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.ledgers.detail(ledgerId) }),
    ]);
  };

  const roleMutation = useMutation({
    mutationFn: (input: { member: LedgerMemberSummary; role: 'EDITOR' | 'VIEWER' }) =>
      updateMemberRole(ledgerId, input.member.id, input.role),
    onMutate: (input) => setPendingMemberId(input.member.id),
    onSettled: async () => {
      setPendingMemberId(null);
      setActionMember(null);
      await refreshMembership();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (member: LedgerMemberSummary) => removeMember(ledgerId, member.id),
    onMutate: (member) => setPendingMemberId(member.id),
    onSettled: async () => {
      setPendingMemberId(null);
      setActionMember(null);
      await refreshMembership();
    },
  });

  const leaveMutation = useMutation({
    mutationFn: () => leaveLedger(ledgerId),
    onSuccess: async () => {
      await refreshMembership();
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] === 'ledger' && query.queryKey[1] === ledgerId,
      });
      // 退出后本地不能再指向这本账本：服务端已拒绝后续所有请求。
      if (currentLedgerId === ledgerId) setCurrentLedgerId('');
      router.replace('/user/ledgers');
    },
  });

  const transferMutation = useMutation({
    mutationFn: (member: LedgerMemberSummary) => transferOwnership(ledgerId, member.id),
    onSettled: async () => {
      setTransferOpen(false);
      setActionMember(null);
      await refreshMembership();
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (input: { targetEmail: string; role: 'EDITOR' | 'VIEWER' }) =>
      createInvitation(ledgerId, input),
    onSuccess: async (invitation) => {
      const token = invitation.inviteToken;
      if (!token) return;
      const inviteLink = buildInviteLink(token);
      setInviteResult({
        targetEmail: invitation.targetEmail,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        inviteLink,
      });
      addSessionInvitation(ledgerId, {
        id: invitation.id,
        ledgerId,
        targetEmail: invitation.targetEmail,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        inviteLink,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.ledgerInvitations(ledgerId) });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (invitation: PendingInvitation) => revokeInvitation(ledgerId, invitation.id),
    onMutate: (invitation) => setPendingInvitationId(invitation.id),
    onSuccess: async (_data, invitation) => {
      removeSessionInvitation(ledgerId, invitation.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.ledgerInvitations(ledgerId) });
    },
    onSettled: () => setPendingInvitationId(null),
  });

  const actionSheetActions = React.useMemo<MemberAction[]>(() => {
    if (!actionMember || !isOwner) return [];
    if (actionMember.role === 'OWNER') {
      return [{ key: 'role', label: '转移账本 Owner', description: '先把 Owner 转给别人，再调整自己的角色' }];
    }
    return [
      {
        key: 'role',
        label: actionMember.role === 'EDITOR' ? '改为只读观察' : '改为记账协作',
        description: actionMember.role === 'EDITOR' ? '只能查看，不能记账' : '可以新增与编辑账单',
      },
      { key: 'remove', label: '移除成员', description: '移除后立即失去该账本访问权', danger: true },
    ];
  }, [actionMember, isOwner]);

  const handleMemberAction = (key: MemberAction['key']): void => {
    if (!actionMember) return;
    if (actionMember.role === 'OWNER') {
      setActionMember(null);
      setTransferOpen(true);
      return;
    }
    if (key === 'role') {
      roleMutation.mutate({
        member: actionMember,
        role: actionMember.role === 'EDITOR' ? 'VIEWER' : 'EDITOR',
      });
      return;
    }
    removeMutation.mutate(actionMember);
  };

  const state: 'loading' | 'error' | 'ready' =
    membersQuery.isPending && !membersQuery.data
      ? 'loading'
      : membersQuery.isError && !membersQuery.data
        ? 'error'
        : 'ready';

  const invitations = React.useMemo<PendingInvitation[]>(() => {
    const sessionById = new Map(sessionInvitations.map((item) => [item.id, item]));
    const serverInvitations = invitationsQuery.data ?? [];
    const merged = serverInvitations.map<PendingInvitation>((item) => ({
      id: item.id,
      targetEmail: item.targetEmail,
      role: item.role,
      createdAt: item.createdAt,
      expiresAt: item.expiresAt,
      inviteLink: sessionById.get(item.id)?.inviteLink,
    }));
    const serverIds = new Set(serverInvitations.map((item) => item.id));
    for (const item of sessionInvitations) {
      if (!serverIds.has(item.id)) {
        merged.push({
          id: item.id,
          targetEmail: item.targetEmail,
          role: item.role,
          expiresAt: item.expiresAt,
          inviteLink: item.inviteLink,
        });
      }
    }
    return merged;
  }, [invitationsQuery.data, sessionInvitations]);

  const invitationState: 'loading' | 'error' | 'empty' | 'ready' =
    !isOwner || ledger?.type !== 'SHARED'
      ? 'empty'
      : invitationsQuery.isPending && !invitationsQuery.data
        ? 'loading'
        : invitationsQuery.isError && !invitationsQuery.data
          ? 'error'
          : invitations.length === 0
            ? 'empty'
            : 'ready';

  return (
    <>
      <MembersView
        state={state}
        ledgerName={ledger?.name ?? null}
        memberCount={ledger?.memberCount ?? members.length}
        members={members}
        currentUserId={currentUserId}
        canManage={Boolean(isOwner)}
        pendingMemberId={pendingMemberId}
        onRetry={() => void membersQuery.refetch()}
        onOpenMemberActions={(member) => {
          roleMutation.reset();
          removeMutation.reset();
          setActionMember(member);
        }}
        canInvite={Boolean(isOwner && ledger?.type === 'SHARED')}
        onInvite={() => {
          inviteMutation.reset();
          setInviteResult(null);
          setInviteOpen(true);
        }}
        invitationState={invitationState}
        invitations={invitations}
        pendingInvitationId={pendingInvitationId}
        onRevokeInvitation={(invitation) => revokeMutation.mutate(invitation)}
        onRetryInvitations={() => void invitationsQuery.refetch()}
        invitationNotice={errorText(revokeMutation.error) ?? errorText(invitationsQuery.error)}
        canTransfer={Boolean(isOwner && members.length > 1)}
        onTransfer={() => {
          transferMutation.reset();
          setTransferOpen(true);
        }}
      />

      <MemberActionSheet
        open={actionMember !== null}
        onOpenChange={(open) => {
          if (!open) setActionMember(null);
        }}
        member={actionMember}
        actions={actionSheetActions}
        onAction={handleMemberAction}
      />

      <InviteMemberSheet
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open);
          if (!open) {
            setInviteResult(null);
            inviteMutation.reset();
          }
        }}
        isSubmitting={inviteMutation.isPending}
        error={errorText(inviteMutation.error)}
        result={inviteResult}
        onSubmit={(input) => inviteMutation.mutate(input)}
      />

      <TransferOwnerSheet
        open={transferOpen}
        onOpenChange={(open) => {
          setTransferOpen(open);
          if (!open) transferMutation.reset();
        }}
        candidates={members.filter((member) => member.user.id !== currentUserId && member.role !== 'OWNER')}
        isSubmitting={transferMutation.isPending}
        error={errorText(transferMutation.error)}
        onConfirm={(member) => transferMutation.mutate(member)}
      />

      {canLeave && (
        <div className="mx-auto max-w-md px-4 pb-8">
          <button
            type="button"
            onClick={() => leaveMutation.mutate()}
            disabled={leaveMutation.isPending}
            className="w-full rounded-2xl border border-rose-200 bg-rose-50 py-3 text-sm font-medium text-rose-600 disabled:opacity-50"
          >
            {leaveMutation.isPending ? '正在退出…' : `退出「${ledger?.name ?? '该账本'}」`}
          </button>
          {errorText(leaveMutation.error) && (
            <p role="alert" className="mt-2 text-center text-xs text-rose-600">
              {errorText(leaveMutation.error)}
            </p>
          )}
        </div>
      )}

      {ledger && !isOwner && (
        <p className="mx-auto max-w-md px-4 pb-8 text-center text-[11px] text-text-tertiary">
          你在此账本中的角色为「{roleLabel(ledger.memberRole)}」
        </p>
      )}
    </>
  );
}
