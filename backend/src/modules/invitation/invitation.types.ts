import type { InvitationStatus, LedgerMemberRole } from '@prisma/client';

export interface CreateInvitationInput {
  targetEmail: string;
  role: 'EDITOR' | 'VIEWER';
}

export interface InvitationLedgerSummary {
  id: string;
  name: string;
  type: string;
  defaultCurrency: string;
  timezone: string;
  icon: string | null;
  color: string | null;
}

export interface InvitationInviterSummary {
  id: string;
  username: string;
  nickname: string | null;
  avatar: string | null;
}

export interface InvitationSummary {
  id: string;
  ledgerId: string;
  targetEmail: string;
  role: LedgerMemberRole;
  status: InvitationStatus;
  createdAt: Date;
  expiresAt: Date;
  inviteToken?: string;
  ledger?: InvitationLedgerSummary;
  inviter?: InvitationInviterSummary;
}

/** 登录前可见的最小邀请说明，不包含账本 ID、成员或账单内容。 */
export interface InvitationPreview {
  ledgerName: string;
  inviterName: string;
  role: LedgerMemberRole;
  status: InvitationStatus;
  expiresAt: Date;
  canRespondAfterLogin: boolean;
}

export type InvitationBlockedReason =
  | 'EMAIL_REQUIRED'
  | 'EMAIL_MISMATCH'
  | 'ALREADY_MEMBER'
  | 'EXPIRED'
  | 'REVOKED'
  | 'DECLINED'
  | 'ACCEPTED'
  | 'LEDGER_UNAVAILABLE';

/** 登录后邀请详情：只暴露当前用户继续处理所需的信息。 */
export interface InvitationDetail extends InvitationSummary {
  targetEmailMasked: string;
  hasEmail: boolean;
  emailMatched: boolean;
  canAccept: boolean;
  canDecline: boolean;
  blockedReason: InvitationBlockedReason | null;
  memberRole?: LedgerMemberRole;
}

export interface AcceptedInvitationResult {
  id: string;
  ledgerId: string;
  memberRole: LedgerMemberRole;
  joinedAt: Date;
  ledger: InvitationLedgerSummary;
  alreadyMember: boolean;
}

export interface NoteSuggestion {
  text: string;
  lastUsedAt: Date;
}
