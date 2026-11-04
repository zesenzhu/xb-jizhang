import type { ApiSuccessResponse } from './auth-types';

export interface LedgerMemberSummary {
  id: string;
  ledgerId: string;
  userId: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  status: 'ACTIVE' | 'LEFT' | 'REMOVED';
  joinedAt: string;
  user: {
    id: string;
    username: string;
    nickname: string | null;
    avatar: string | null;
  };
}

export interface LedgerMemberListResponse {
  items: LedgerMemberSummary[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

export type LedgerMemberListApiResponse = ApiSuccessResponse<LedgerMemberListResponse>;
