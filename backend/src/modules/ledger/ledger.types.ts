import type { LedgerMemberRole, LedgerType } from '@prisma/client';

export interface LedgerQuery {
  page: number;
  pageSize: number;
  includeArchived?: boolean;
}

export interface CreateLedgerInput {
  name: string;
  type: LedgerType;
  defaultCurrency?: string;
  icon?: string | null;
  color?: string | null;
}

export interface UpdateLedgerInput {
  name?: string;
  icon?: string | null;
  color?: string | null;
  isArchived?: boolean;
  updatedAt: Date;
}

export interface LedgerSummary {
  id: string;
  name: string;
  type: LedgerType;
  defaultCurrency: string;
  icon: string | null;
  color: string | null;
  isArchived: boolean;
  memberRole: LedgerMemberRole;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
