'use client';

import * as React from 'react';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/api/user-auth-api';
import { initializeAuthSession } from '@/lib/auth/initialize-auth';
import { getLoginRedirectUrl } from '@/lib/routing/routes';
import { useUserAuthStore } from '@/store/userAuthStore';
import { BillListSkeleton } from '@/components/skeleton/BillListSkeleton';
import { LedgerListSkeleton } from '@/components/skeleton/LedgerListSkeleton';
import { UserProfileSkeleton } from '@/components/skeleton/UserProfileSkeleton';
import { SecondaryPageSkeleton } from '@/components/skeleton/SecondaryPageSkeleton';
import { MemberListSkeleton } from '@/components/skeleton/MemberListSkeleton';

export interface UserAuthBoundaryProps {
  children: React.ReactNode;
  /** 自定义未决验证期间的骨架占位组件，未传时根据当前访问路由自动智能匹配 1:1 页面专属骨架 */
  fallback?: React.ReactNode;
  /** 邀请页允许未登录查看公开预览；其他页面保持强制登录。 */
  allowAnonymous?: boolean;
}

/**
 * 根据当前访问路由自动推导最匹配的 1:1 页面专属骨架
 */
function resolveRouteSkeleton(pathname: string | null): React.ReactNode {
  const path = pathname?.replace(/\/$/, '') || '';

  if (path === '/user/profile') {
    return <UserProfileSkeleton />;
  }

  if (path === '/user/ledgers') {
    return <LedgerListSkeleton />;
  }

  if (path.startsWith('/user/ledgers/') && path.endsWith('/members')) {
    return <MemberListSkeleton />;
  }

  if (path.startsWith('/user/ledgers/')) {
    return <SecondaryPageSkeleton title="账本设置" subtitle="账本空间" />;
  }

  if (path === '/user/invitations') {
    return <SecondaryPageSkeleton title="我的邀请" subtitle="用户工作区" />;
  }

  // 一级 Tab 与未知路径统一使用账单页骨架，与 /user 的真实结构对齐
  return <BillListSkeleton />;
}

export function UserAuthBoundary({
  children,
  fallback,
  allowAnonymous = false,
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
    if (status === 'unauthenticated' && !allowAnonymous) {
      router.replace(getLoginRedirectUrl('user', pathname, window.location.search));
    }
  }, [allowAnonymous, pathname, router, status]);

  if (status === 'unknown' || status === 'refreshing') {
    return <>{fallback ?? resolveRouteSkeleton(pathname)}</>;
  }

  if (status === 'unauthenticated' && !allowAnonymous) {
    return <>{fallback ?? resolveRouteSkeleton(pathname)}</>;
  }

  return <>{children}</>;
}
