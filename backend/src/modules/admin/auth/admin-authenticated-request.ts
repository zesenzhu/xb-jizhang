import type { Request } from 'express';
import type { AdminContext } from '../common/admin.types';

export type AdminAuthenticatedRequest = Request & {
  cookies?: Record<string, string | undefined>;
  adminUser?: AdminContext;
};
