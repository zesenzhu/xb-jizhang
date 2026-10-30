export interface AdminLedgerQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: 'ACTIVE' | 'ARCHIVED';
  type?: 'PERSONAL' | 'SHARED';
}

export interface UpdateLedgerStatusInput {
  status: 'ACTIVE' | 'ARCHIVED';
  reason: string;
  updatedAt: Date;
}

export interface AdminLedgerRequestMetadata {
  requestId: string;
  ip?: string;
  userAgent?: string;
}
