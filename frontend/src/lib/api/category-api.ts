import { userClient } from './user-client';
import type { ApiSuccessResponse } from './auth-types';
import type { CategoryListApiResponse, CategoryListQuery, CategoryListResponse } from './category-types';

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
