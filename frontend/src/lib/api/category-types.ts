import type { ApiSuccessResponse } from './auth-types';

export type CategoryType = 'EXPENSE' | 'INCOME';

export type CategoryIconSource = 'NONE' | 'LIBRARY' | 'IMAGE';

/**
 * 第五期分类图标字段。字段保持可选，是为了兼容后端仍返回旧 `icon` 字段的过渡期。
 */
export interface CategoryIconFields {
  iconSource?: CategoryIconSource | null;
  iconKey?: string | null;
  iconAssetId?: string | null;
  iconUrl?: string | null;
  iconUrlExpiresAt?: string | null;
  color: string | null;
}

export interface CategorySummary extends CategoryIconFields {
  id: string;
  ledgerId: string;
  type: CategoryType;
  name: string;
  defaultKey?: string | null;
  /** 旧版后端字段，读取时由 category-icon 归一化。 */
  icon?: string | null;
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

export interface CategoryIconLibraryItem {
  key: string;
  label: string;
  aliases: string[];
  group: string;
  defaultTypes: CategoryType[];
}

export interface CategoryIconLibraryResponse {
  items: CategoryIconLibraryItem[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

export interface CategoryIconLibraryQuery {
  type?: CategoryType;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface CategoryIconUploadSession {
  assetId: string;
  status: 'PENDING' | 'ATTACHED';
  uploadMethod: 'PUT';
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  expiresAt: string;
}

export interface CategoryIconUploadResult {
  assetId: string;
  status: 'ATTACHED';
  mimeType: string;
  sizeBytes: number;
  accessUrl: string;
  accessUrlExpiresAt: string;
}

export interface CategoryIconAccessUrl {
  assetId: string;
  accessUrl: string;
  accessUrlExpiresAt: string;
}

export interface CreateCategoryIconUploadSessionInput {
  clientRequestId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export type CategoryIconLibraryApiResponse = ApiSuccessResponse<CategoryIconLibraryResponse>;
export type CategoryIconUploadSessionApiResponse = ApiSuccessResponse<CategoryIconUploadSession>;
export type CategoryIconUploadResultApiResponse = ApiSuccessResponse<CategoryIconUploadResult>;
export type CategoryIconAccessUrlApiResponse = ApiSuccessResponse<CategoryIconAccessUrl>;
