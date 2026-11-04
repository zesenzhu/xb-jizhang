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
  timezone?: string;
  icon?: string | null;
  color?: string | null;
}

export interface UpdateLedgerInput {
  name?: string;
  defaultCurrency?: string;
  timezone?: string;
  icon?: string | null;
  color?: string | null;
  updatedAt: Date;
}

export interface LedgerSummary {
  id: string;
  name: string;
  type: LedgerType;
  defaultCurrency: string;
  timezone: string;
  icon: string | null;
  color: string | null;
  isArchived: boolean;
  memberCount: number;
  isCurrent: boolean;
  isDefault: boolean;
  memberRole: LedgerMemberRole;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
