import { userClient } from './user-client';
import type { ApiSuccessResponse } from './auth-types';
import type {
  CategoryListApiResponse,
  CategoryListQuery,
  CategoryListResponse,
  CategorySummary,
  CategoryType,
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
}

export interface UpdateCategoryInput {
  name?: string;
  parentId?: string | null;
  sortOrder?: number;
  icon?: string | null;
  color?: string | null;
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
