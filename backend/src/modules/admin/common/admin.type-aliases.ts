import {
  ADMIN_PERMISSION_CODES,
  ADMIN_ROLE_CODES,
} from './admin.constants';

export type AdminRoleCode = (typeof ADMIN_ROLE_CODES)[number];
export type AdminPermissionCode = (typeof ADMIN_PERMISSION_CODES)[number];
