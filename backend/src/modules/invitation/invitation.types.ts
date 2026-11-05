import type { InvitationStatus, LedgerMemberRole } from '@prisma/client';

export interface CreateInvitationInput {
  targetEmail: string;
  role: 'EDITOR' | 'VIEWER';
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
  ledger?: {
    id: string;
    name: string;
    type: string;
    defaultCurrency: string;
    icon: string | null;
    color: string | null;
    isArchived: boolean;
  };
}

export interface AcceptedInvitationResult {
  id: string;
  ledgerId: string;
  memberRole: 'EDITOR' | 'VIEWER';
  joinedAt: Date;
  ledger: NonNullable<InvitationSummary['ledger']>;
}
