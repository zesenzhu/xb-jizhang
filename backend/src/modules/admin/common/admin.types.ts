import type { AdminPermissionCode, AdminRoleCode } from './admin.type-aliases';

export interface AdminContext {
  id: string;
  username: string;
  displayName: string;
  roles: string[];
  permissions: string[];
}

export interface AdminTokenPayload {
  sub: string;
  type: 'admin_access';
  aud: 'admin';
}

export interface AdminSessionMetadata {
  deviceName?: string;
  userAgent?: string;
}

export interface SafeAdminUser {
  id: string;
  username: string;
  displayName: string;
  isActive: boolean;
  roles: string[];
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export interface AdminLoginResult {
  user: SafeAdminUser;
  accessToken: string;
  refreshToken: string;
}

export interface AdminAuditInput {
  adminUserId: string;
  requestId: string;
  action: string;
  targetType: string;
  targetId?: string;
  reason?: string;
  beforeData?: unknown;
  afterData?: unknown;
  result: 'SUCCESS' | 'FAILURE';
  errorCode?: string;
  ip?: string;
  userAgent?: string;
}

export type { AdminPermissionCode, AdminRoleCode };
