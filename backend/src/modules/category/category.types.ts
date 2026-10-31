import type { CategoryType } from '@prisma/client';

export interface CategoryQuery {
  page: number;
  pageSize: number;
  type?: CategoryType;
  includeInactive?: boolean;
}

export interface CreateCategoryInput {
  type: CategoryType;
  name: string;
  sortOrder?: number;
  icon?: string | null;
  color?: string | null;
}

export interface UpdateCategoryInput {
  name?: string;
  sortOrder?: number;
  icon?: string | null;
  color?: string | null;
  isActive?: boolean;
}

export interface CategorySummary {
  id: string;
  ledgerId: string;
  type: CategoryType;
  name: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
