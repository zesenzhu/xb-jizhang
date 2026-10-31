import type { ApiSuccessResponse } from './auth-types';

export type LedgerType = 'PERSONAL' | 'SHARED';
export type LedgerMemberRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export interface LedgerSummary {
  id: string;
  name: string;
  type: LedgerType;
  defaultCurrency: string;
  icon: string | null;
  color: string | null;
  isArchived: boolean;
  memberRole: LedgerMemberRole;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerListQuery {
  page?: number;
  pageSize?: number;
  includeArchived?: boolean;
}

export interface LedgerListResponse {
  items: LedgerSummary[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
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
  updatedAt: string;
}

export type LedgerListApiResponse = ApiSuccessResponse<LedgerListResponse>;
