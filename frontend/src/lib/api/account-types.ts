import type { ApiSuccessResponse } from './auth-types';

export type AccountVisibility = 'SHARED' | 'PRIVATE';
export type AccountType = 'CASH' | 'BANK_CARD' | 'CREDIT_CARD' | 'ALIPAY' | 'WECHAT' | 'OTHER';

export interface AccountSummary {
  id: string;
  ledgerId: string;
  ownerId: string | null;
  name: string;
  type: AccountType;
  visibility: AccountVisibility;
  initialBalanceCents: number;
  currentBalanceCents: number;
  includeInAssets: boolean;
  icon: string | null;
  color: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountListResponse {
  items: AccountSummary[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

export interface AccountListQuery {
  page?: number;
  pageSize?: number;
  includeInactive?: boolean;
}

export type AccountListApiResponse = ApiSuccessResponse<AccountListResponse>;
