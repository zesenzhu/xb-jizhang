import type { ApiSuccessResponse } from './auth-types';

export type LedgerType = 'PERSONAL' | 'SHARED';
export type LedgerMemberRole = 'OWNER' | 'EDITOR' | 'VIEWER';

/**
 * 账本摘要。
 *
 * `memberRole`/`memberCount`/`isCurrent`/`isDefault`/`timezone` 全部由服务端按当前用户的
 * 成员关系与偏好计算，客户端只读：自己推算会和「我的账本」列表、切换接口的结论打架。
 */
export interface LedgerSummary {
  id: string;
  name: string;
  type: LedgerType;
  defaultCurrency: string;
  timezone: string;
  icon: string | null;
  color: string | null;
  isArchived: boolean;
  memberRole: LedgerMemberRole;
  memberCount: number;
  isCurrent: boolean;
  isDefault: boolean;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerListQuery {
  page?: number;
  pageSize?: number;
}

export interface LedgerListResponse {
  items: LedgerSummary[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

/** 偏好里的账本摘要字段更少：只够渲染标题与切换确认，不含时间戳。 */
export interface LedgerPreferencesLedger {
  id: string;
  name: string;
  type: LedgerType;
  defaultCurrency: string;
  timezone: string;
  memberRole: LedgerMemberRole;
}

export interface LedgerPreferences {
  currentLedgerId: string | null;
  defaultLedgerId: string | null;
  currentLedger: LedgerPreferencesLedger | null;
  defaultLedger: LedgerPreferencesLedger | null;
  updatedAt: string;
}

export interface UpdateLedgerPreferencesInput {
  currentLedgerId?: string;
  defaultLedgerId?: string;
}

export interface CreateLedgerInput {
  name: string;
  type: LedgerType;
  defaultCurrency?: string;
  timezone?: string;
  icon?: string | null;
  color?: string | null;
}

/** 复制必须带 `clientRequestId`：重试不能产生第二个副本。 */
export interface CopyLedgerInput {
  name: string;
  type: LedgerType;
  clientRequestId: string;
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
  /** 客户端最后读取到的版本；与服务端不一致时返回 40902 */
  updatedAt: string;
}

export type LedgerListApiResponse = ApiSuccessResponse<LedgerListResponse>;
