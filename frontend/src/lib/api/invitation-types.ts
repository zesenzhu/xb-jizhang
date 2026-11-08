import type { LedgerType } from './ledger-types';

export type InvitationRole = 'EDITOR' | 'VIEWER';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'REVOKED';
export type InvitationBlockedReason =
  | 'EMAIL_REQUIRED'
  | 'EMAIL_MISMATCH'
  | 'ALREADY_MEMBER'
  | 'EXPIRED'
  | 'REVOKED'
  | 'DECLINED'
  | 'ACCEPTED'
  | 'LEDGER_UNAVAILABLE';

/** 邀请里的账本摘要：只含展示需要的字段，不含成员与权限。 */
export interface InvitationLedgerRef {
  id: string;
  name: string;
  type: LedgerType;
  defaultCurrency: string;
  timezone?: string;
  icon: string | null;
  color: string | null;
  isArchived?: boolean;
}

export interface InvitationInviterRef {
  id: string;
  username?: string;
  nickname: string | null;
  avatar: string | null;
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
  inviter?: InvitationInviterRef;
  ledger?: InvitationLedgerRef;
}

export interface InvitationPreview {
  ledgerName: string;
  inviterName: string;
  role: InvitationRole;
  status: InvitationStatus;
  expiresAt: string;
  canRespondAfterLogin: boolean;
}

export interface InvitationDetail extends InvitationSummary {
  targetEmailMasked: string;
  hasEmail: boolean;
  emailMatched: boolean;
  canAccept: boolean;
  canDecline: boolean;
  blockedReason: InvitationBlockedReason | null;
  memberRole?: 'OWNER' | InvitationRole;
}

export interface CreateInvitationInput {
  targetEmail: string;
  role: InvitationRole;
}

export interface AcceptedInvitationResult {
  id: string;
  ledgerId: string;
  memberRole: 'OWNER' | InvitationRole;
  joinedAt: string;
  ledger: InvitationLedgerRef;
  alreadyMember: boolean;
}
