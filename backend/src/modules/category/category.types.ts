import type { CategoryIconSource, CategoryType } from '@prisma/client';

export interface CategoryQuery {
  page: number;
  pageSize: number;
  type?: CategoryType;
  includeInactive?: boolean;
}

export interface CreateCategoryInput {
  type: CategoryType;
  name: string;
  parentId?: string | null;
  sortOrder?: number;
  icon?: string | null;
  iconSource?: CategoryIconSource;
  iconKey?: string | null;
  iconAssetId?: string | null;
  color?: string | null;
}

export interface UpdateCategoryInput {
  name?: string;
  parentId?: string | null;
  sortOrder?: number;
  icon?: string | null;
  iconSource?: CategoryIconSource;
  iconKey?: string | null;
  iconAssetId?: string | null;
  color?: string | null;
  isActive?: boolean;
}

export interface CategorySummary {
  id: string;
  ledgerId: string;
  type: CategoryType;
  name: string;
  parentId: string | null;
  icon: string | null;
  iconSource: CategoryIconSource;
  iconKey: string | null;
  iconAssetId: string | null;
  defaultKey: string | null;
  iconUrl?: string | null;
  iconUrlExpiresAt?: Date | null;
  color: string | null;
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
