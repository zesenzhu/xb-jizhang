import type { ApiSuccessResponse } from './auth-types';

export type CategoryType = 'EXPENSE' | 'INCOME';

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
  createdAt: string;
  updatedAt: string;
  /** 父级分类 ID；为空表示一级分类。 */
  parentId: string | null;
}

export interface CategoryListResponse {
  items: CategorySummary[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

export interface CategoryListQuery {
  page?: number;
  pageSize?: number;
  type?: CategoryType;
  includeInactive?: boolean;
}

export type CategoryListApiResponse = ApiSuccessResponse<CategoryListResponse>;
