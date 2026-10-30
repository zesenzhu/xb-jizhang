import { SetMetadata } from '@nestjs/common';
import type { AdminPermissionCode } from './admin.type-aliases';

export const ADMIN_PERMISSIONS_KEY = 'admin_permissions';

export const RequireAdminPermission = (...permissions: AdminPermissionCode[]) =>
  SetMetadata(ADMIN_PERMISSIONS_KEY, permissions);
