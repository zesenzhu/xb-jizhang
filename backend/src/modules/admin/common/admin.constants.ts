export const ADMIN_ACCESS_TOKEN_COOKIE = 'admin_access_token';
export const ADMIN_REFRESH_TOKEN_COOKIE = 'admin_refresh_token';
export const ADMIN_TOKEN_AUDIENCE = 'admin';
export const ADMIN_ACCESS_TOKEN_TYPE = 'admin_access';
export const ADMIN_AUTH_ERROR_CODE = 40103;
export const ADMIN_PERMISSION_ERROR_CODE = 40302;

export const ADMIN_ROLE_CODES = ['SUPER_ADMIN', 'OPERATOR', 'AUDITOR'] as const;

export const ADMIN_PERMISSION_CODES = [
  'admin:user:read',
  'admin:user:status',
  'admin:ledger:read',
  'admin:ledger:status',
  'admin:transaction:read_sensitive',
  'admin:transaction:write',
  'admin:config:read',
  'admin:config:write',
  'admin:audit:read',
  'admin:admin_user:manage',
] as const;

export const BUILT_IN_ADMIN_ROLE_PERMISSIONS: Record<
  (typeof ADMIN_ROLE_CODES)[number],
  readonly (typeof ADMIN_PERMISSION_CODES)[number][]
> = {
  SUPER_ADMIN: ADMIN_PERMISSION_CODES,
  OPERATOR: [
    'admin:user:read',
    'admin:user:status',
    'admin:ledger:read',
    'admin:ledger:status',
    'admin:audit:read',
  ],
  AUDITOR: ['admin:user:read', 'admin:ledger:read', 'admin:audit:read'],
};
