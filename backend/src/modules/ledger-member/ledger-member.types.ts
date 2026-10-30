import type { LedgerMemberRole, LedgerMemberStatus } from '@prisma/client';

export interface LedgerMemberSummary {
  id: string;
  ledgerId: string;
  userId: string;
  role: LedgerMemberRole;
  status: LedgerMemberStatus;
  joinedAt: Date;
  user: {
    id: string;
    username: string;
    nickname: string | null;
    avatar: string | null;
  };
}

export interface OwnershipTransferResult {
  previousOwner: LedgerMemberSummary;
  newOwner: LedgerMemberSummary;
}
