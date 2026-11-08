'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { UserAuthBoundary } from '@/components/auth/UserAuthBoundary';

/**
 * 邀请页需要允许未登录查看公开预览；其余工作区页面仍由 UserAuthBoundary 强制登录。
 */
export function UserWorkspaceAuthShell({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  const pathname = usePathname();
  const normalizedPath = pathname?.replace(/\/$/, '') || '';
  const allowAnonymous = normalizedPath === '/user/invitations';
  return <UserAuthBoundary allowAnonymous={allowAnonymous}>{children}</UserAuthBoundary>;
}
