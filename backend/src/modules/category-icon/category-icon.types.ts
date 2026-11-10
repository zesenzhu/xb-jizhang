import type { CategoryIconAssetStatus, CategoryType } from '@prisma/client';
import type { CategoryIconMimeType } from './category-icon.constants';

export interface CategoryIconLibraryQuery {
  page: number;
  pageSize: number;
  type?: CategoryType;
  q?: string;
}

export interface CreateCategoryIconUploadInput {
  clientRequestId: string;
  fileName: string;
  mimeType: CategoryIconMimeType;
  sizeBytes: number;
}

export interface CategoryIconSummary {
  assetId: string;
  status: CategoryIconAssetStatus;
  mimeType: string | null;
  sizeBytes: number | null;
  accessUrl?: string;
  accessUrlExpiresAt?: Date;
  createdAt: Date;
  uploadedAt: Date | null;
}

export interface CategoryIconUploadSession extends CategoryIconSummary {
  uploadMethod?: 'PUT';
  uploadUrl?: string;
  requiredHeaders?: Record<string, string>;
  expiresAt?: Date;
}
