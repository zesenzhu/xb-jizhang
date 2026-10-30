export interface SafeUser {
  id: string;
  username: string;
  nickname: string | null;
  email: string | null;
  avatar: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerSummary {
  id: string;
  name: string;
  type: 'PERSONAL' | 'SHARED';
  defaultCurrency?: string;
  icon?: string | null;
  color?: string | null;
  isArchived?: boolean;
  role?: 'OWNER' | 'EDITOR' | 'VIEWER';
  memberRole?: 'OWNER' | 'EDITOR' | 'VIEWER';
}

export interface LoginParams {
  username: string;
  password: string;
}

export interface RegisterParams {
  username: string;
  password: string;
  nickname?: string;
  email?: string;
}

export interface LoginResponse {
  user: SafeUser;
  ledgers: LedgerSummary[];
}

export interface RegisterResponse {
  user: SafeUser;
  defaultLedger: LedgerSummary;
}

