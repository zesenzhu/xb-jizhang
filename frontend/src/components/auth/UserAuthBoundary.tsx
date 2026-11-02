'use client';

import * as React from 'react';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/api/user-auth-api';
import { initializeAuthSession } from '@/lib/auth/initialize-auth';
import { getLoginRedirectUrl } from '@/lib/routing/routes';
import { useUserAuthStore } from '@/store/userAuthStore';
import { UserHomeSkeleton } from '@/components/auth/UserHomeSkeleton';
import { LedgerListSkeleton } from '@/components/skeleton/LedgerListSkeleton';
import { UserProfileSkeleton } from '@/components/skeleton/UserProfileSkeleton';
import { SecondaryPageSkeleton } from '@/components/skeleton/SecondaryPageSkeleton';

export interface UserAuthBoundaryProps {
  children: React.ReactNode;
  /** 自定义未决验证期间的骨架占位组件，未传时根据当前访问路由自动智能匹配 1:1 页面专属骨架 */
  fallback?: React.ReactNode;
}

/**
 * 根据当前访问路由自动推导最匹配的 1:1 页面专属骨架
 */
function resolveRouteSkeleton(pathname: string | null): React.ReactNode {
  const path = pathname?.replace(/\/$/, '') || '';

  if (path === '/user/profile') {
    return <UserProfileSkeleton />;
  }

  if (path === '/user/ledger') {
    return <LedgerListSkeleton />;
  }

  if (path.startsWith('/user/ledger/')) {
    const isNew = path === '/user/ledger/new';
    return (
      <SecondaryPageSkeleton
        title={isNew ? '新建账本' : '账本设置'}
        subtitle="账本空间"
      />
    );
  }

  // 默认使用首页明细（当前活跃账本 + 触控记账键盘）专属骨架
  return <UserHomeSkeleton />;
}

export function UserAuthBoundary({
  children,
  fallback,
}: UserAuthBoundaryProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const status = useUserAuthStore((state) => state.status);
  const setCurrentUser = useUserAuthStore((state) => state.setCurrentUser);
  const setStatus = useUserAuthStore((state) => state.setStatus);
  const clear = useUserAuthStore((state) => state.clear);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (status !== 'unknown') return;
    setStatus('refreshing');
    void initializeAuthSession({
      load: getCurrentUser,
      isActive: () => mountedRef.current,
      onAuthenticated: (user) => {
        setCurrentUser(user);
        setStatus('authenticated');
      },
      onUnauthenticated: () => {
        clear();
        setStatus('unauthenticated');
      },
    });
  }, [clear, router, setCurrentUser, setStatus, status]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(getLoginRedirectUrl('user', pathname));
    }
  }, [pathname, router, status]);

  if (status !== 'authenticated') {
    return <>{fallback ?? resolveRouteSkeleton(pathname)}</>;
  }

  return <>{children}</>;
}
