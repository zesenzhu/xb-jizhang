export interface ApiSuccessResponse<T> {
  success: true;
  code: 0;
  message: string;
  data: T;
}

export interface UserSummary {
  id: string;
  username: string;
  nickname: string | null;
  email: string | null;
  avatar: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type LedgerType = 'PERSONAL' | 'SHARED';
export type LedgerMemberRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export interface LedgerSummary {
  id: string;
  name: string;
  type: LedgerType;
  defaultCurrency: string;
  icon?: string | null;
  color?: string | null;
  isArchived?: boolean;
  memberRole?: LedgerMemberRole;
  joinedAt?: string;
}

export interface UserRegisterResponse {
  user: UserSummary;
  defaultLedger: LedgerSummary;
}

export interface UserLoginResponse {
  user: UserSummary;
  ledgers: LedgerSummary[];
}

export interface AdminSummary {
  id: string;
  username: string;
  displayName: string;
  isActive: boolean;
  roles: string[];
  permissions: string[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}
