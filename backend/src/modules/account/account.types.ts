import type { AccountType, AccountVisibility } from '@prisma/client';

export interface AccountQuery {
  page: number;
  pageSize: number;
  includeInactive?: boolean;
}

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  visibility: AccountVisibility;
  initialBalanceCents?: number;
  includeInAssets?: boolean;
  icon?: string | null;
  color?: string | null;
}

export interface UpdateAccountInput {
  name?: string;
  includeInAssets?: boolean;
  icon?: string | null;
  color?: string | null;
  isActive?: boolean;
}

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
  createdAt: Date;
  updatedAt: Date;
}
