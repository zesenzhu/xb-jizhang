import { userClient } from './user-client';
import type { ApiSuccessResponse } from './auth-types';
import type {
  CategoryIconAccessUrl,
  CategoryIconAccessUrlApiResponse,
  CategoryIconLibraryApiResponse,
  CategoryIconLibraryQuery,
  CategoryIconLibraryResponse,
  CategoryIconUploadResult,
  CategoryIconUploadResultApiResponse,
  CategoryIconUploadSession,
  CategoryIconUploadSessionApiResponse,
  CategoryListApiResponse,
  CategoryListQuery,
  CategoryListResponse,
  CategorySummary,
  CategoryType,
  CreateCategoryIconUploadSessionInput,
} from './category-types';

function unwrap<T>(response: { data: ApiSuccessResponse<T> }): T {
  return response.data.data;
}

export async function getCategories(
  ledgerId: string,
  query: CategoryListQuery = {},
): Promise<CategoryListResponse> {
  const params: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params[key] = value as string | number | boolean;
    }
  }

  return unwrap(
    await userClient.get<CategoryListApiResponse>(
      `/ledgers/${encodeURIComponent(ledgerId)}/categories`,
      { params },
    ),
  );
}

export interface CreateCategoryInput {
  type: CategoryType;
  name: string;
  parentId?: string | null;
  sortOrder?: number;
  icon?: string | null;
  color?: string | null;
  iconSource?: 'NONE' | 'LIBRARY' | 'IMAGE';
  iconKey?: string | null;
  iconAssetId?: string | null;
}

export interface UpdateCategoryInput {
  name?: string;
  parentId?: string | null;
  sortOrder?: number;
  icon?: string | null;
  color?: string | null;
  iconSource?: 'NONE' | 'LIBRARY' | 'IMAGE';
  iconKey?: string | null;
  iconAssetId?: string | null;
  isActive?: boolean;
}

export async function createCategory(
  ledgerId: string,
  input: CreateCategoryInput,
): Promise<CategorySummary> {
  return unwrap(
    await userClient.post<ApiSuccessResponse<CategorySummary>>(
      `/ledgers/${encodeURIComponent(ledgerId)}/categories`,
      input,
    ),
  );
}

export async function updateCategory(
  ledgerId: string,
  categoryId: string,
  input: UpdateCategoryInput,
): Promise<CategorySummary> {
  return unwrap(
    await userClient.patch<ApiSuccessResponse<CategorySummary>>(
      `/ledgers/${encodeURIComponent(ledgerId)}/categories/${encodeURIComponent(categoryId)}`,
      input,
    ),
  );
}

function iconPath(ledgerId: string, suffix: string): string {
  return `/ledgers/${encodeURIComponent(ledgerId)}/category-icons/${suffix}`;
}

function assetPath(ledgerId: string, suffix: string): string {
  return `/ledgers/${encodeURIComponent(ledgerId)}/category-icon-assets/${suffix}`;
}

function omitEmptyParams(query: object): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params[key] = value as string | number | boolean;
    }
  }
  return params;
}

export async function getCategoryIconLibrary(
  ledgerId: string,
  query: CategoryIconLibraryQuery = {},
): Promise<CategoryIconLibraryResponse> {
  return unwrap(
    await userClient.get<CategoryIconLibraryApiResponse>(iconPath(ledgerId, 'library'), {
      params: omitEmptyParams(query),
    }),
  );
}

export async function createCategoryIconUploadSession(
  ledgerId: string,
  input: CreateCategoryIconUploadSessionInput,
): Promise<CategoryIconUploadSession> {
  return unwrap(
    await userClient.post<CategoryIconUploadSessionApiResponse>(
      assetPath(ledgerId, 'upload-sessions'),
      input,
    ),
  );
}

/**
 * 预签名 PUT 必须直接访问对象存储，不能经过 userClient 的 `/api` baseURL 和刷新拦截器。
 */
export async function uploadCategoryIconObject(
  uploadUrl: string,
  uploadMethod: 'PUT',
  requiredHeaders: Record<string, string>,
  file: Blob,
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: uploadMethod,
    headers: requiredHeaders,
    body: file,
    credentials: 'omit',
  });

  if (!response.ok) {
    throw new CategoryIconStorageError(response.status);
  }
}

export async function completeCategoryIconUpload(
  ledgerId: string,
  assetId: string,
): Promise<CategoryIconUploadResult> {
  return unwrap(
    await userClient.post<CategoryIconUploadResultApiResponse>(
      assetPath(ledgerId, `${encodeURIComponent(assetId)}/complete`),
    ),
  );
}

export async function getCategoryIconAccessUrl(
  ledgerId: string,
  assetId: string,
): Promise<CategoryIconAccessUrl> {
  return unwrap(
    await userClient.get<CategoryIconAccessUrlApiResponse>(
      assetPath(ledgerId, `${encodeURIComponent(assetId)}/access-url`),
    ),
  );
}

export async function restoreDefaultCategoryIcon(
  ledgerId: string,
  categoryId: string,
): Promise<CategorySummary> {
  return unwrap(
    await userClient.post<ApiSuccessResponse<CategorySummary>>(
      `/ledgers/${encodeURIComponent(ledgerId)}/categories/${encodeURIComponent(categoryId)}/restore-default-icon`,
    ),
  );
}

export class CategoryIconStorageError extends Error {
  readonly status: number;

  constructor(status: number) {
    super('分类图标上传失败');
    this.name = 'CategoryIconStorageError';
    this.status = status;
  }
}
