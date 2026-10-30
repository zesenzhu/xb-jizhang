import type { Request } from 'express';
import type { SafeUser } from '../../modules/auth/auth.types';

export interface AuthUser {
  id: string;
}

export type AuthenticatedRequest = Request & {
  cookies?: Record<string, string | undefined>;
  user?: AuthUser;
};

export type AuthenticatedUserProfile = SafeUser;
