export interface AdminUserQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface UpdateAdminUserInput {
  isActive?: boolean;
  roleCodes?: string[];
  reason: string;
  updatedAt: Date;
}

export interface AdminUserRequestMetadata {
  requestId: string;
  ip?: string;
  userAgent?: string;
}
