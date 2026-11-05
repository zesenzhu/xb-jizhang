import type { LedgerType } from './ledger-types';

export type InvitationRole = 'EDITOR' | 'VIEWER';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'REVOKED';

/** 邀请里的账本摘要：只含展示需要的字段，不含成员与权限。 */
export interface InvitationLedgerRef {
  id: string;
  name: string;
  type: LedgerType;
  defaultCurrency: string;
  icon: string | null;
  color: string | null;
  isArchived: boolean;
}

export interface InvitationSummary {
  id: string;
  ledgerId: string;
  targetEmail: string;
  role: InvitationRole;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
  /** 只在创建成功的响应里出现一次；后续查询永远拿不到 */
  inviteToken?: string;
  ledger?: InvitationLedgerRef;
}

export interface CreateInvitationInput {
  targetEmail: string;
  role: InvitationRole;
}

export interface AcceptedInvitationResult {
  id: string;
  ledgerId: string;
  memberRole: InvitationRole;
  joinedAt: string;
  ledger: InvitationLedgerRef;
}
