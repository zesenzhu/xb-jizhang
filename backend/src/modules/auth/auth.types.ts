import type { User } from '@prisma/client';

export interface RegisterInput {
  username: string;
  password: string;
  nickname?: string;
  email?: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface SessionMetadata {
  deviceName?: string;
  userAgent?: string;
}

export interface SafeUser {
  id: string;
  username: string;
  nickname: string | null;
  email: string | null;
  avatar: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LedgerSummary {
  id: string;
  name: string;
  type: string;
  defaultCurrency: string;
  icon?: string | null;
  color?: string | null;
  isArchived?: boolean;
  memberRole?: string;
  joinedAt?: Date;
}

export interface AuthSessionResult {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterResult extends AuthSessionResult {
  defaultLedger: LedgerSummary;
}

export interface LoginResult extends AuthSessionResult {
  ledgers: LedgerSummary[];
}

export interface AccessTokenPayload {
  sub: string;
  type: 'access';
}

export function toSafeUser(user: Pick<User, keyof SafeUser>): SafeUser {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    email: user.email,
    avatar: user.avatar,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function normalizeEmail(email?: string | null): string | null {
  if (email == null) return null;
  const normalizedEmail = email.trim().toLowerCase();
  return normalizedEmail.length > 0 ? normalizedEmail : null;
}
