export interface AdminAuditQuery {
  page: number;
  pageSize: number;
  adminUserId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  result?: 'SUCCESS' | 'FAILURE';
  requestId?: string;
  createdFrom?: Date;
  createdTo?: Date;
}
