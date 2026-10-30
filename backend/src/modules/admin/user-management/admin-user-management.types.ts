export interface AdminUserQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  createdFrom?: Date;
  createdTo?: Date;
}

export interface UpdateUserStatusInput {
  status: 'ACTIVE' | 'INACTIVE';
  reason: string;
  updatedAt: Date;
}

export interface AdminUserRequestMetadata {
  requestId: string;
  ip?: string;
  userAgent?: string;
}
