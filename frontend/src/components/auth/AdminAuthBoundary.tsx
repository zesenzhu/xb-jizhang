'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getCurrentAdmin } from '@/lib/api/admin-auth-api';
import { initializeAuthSession } from '@/lib/auth/initialize-auth';
import { getLoginRedirectUrl } from '@/lib/routing/routes';
import { useAdminAuthStore } from '@/store/adminAuthStore';

export function AdminAuthBoundary({ children }: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const status = useAdminAuthStore((state) => state.status);
  const setCurrentAdmin = useAdminAuthStore((state) => state.setCurrentAdmin);
  const setStatus = useAdminAuthStore((state) => state.setStatus);
  const clear = useAdminAuthStore((state) => state.clear);
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
      load: getCurrentAdmin,
      isActive: () => mountedRef.current,
      onAuthenticated: (admin) => {
        setCurrentAdmin(admin);
        setStatus('authenticated');
      },
      onUnauthenticated: () => {
        clear();
        setStatus('unauthenticated');
      },
    });

  }, [clear, router, setCurrentAdmin, setStatus, status]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(getLoginRedirectUrl('admin', pathname));
    }
  }, [pathname, router, status]);

  if (status !== 'authenticated') {
    return <p>正在验证管理员登录状态...</p>;
  }
  return <>{children}</>;
}
