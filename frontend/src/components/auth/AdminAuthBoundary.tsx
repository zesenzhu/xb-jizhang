'use client';

import { useEffect } from 'react';
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

  useEffect(() => {
    if (status !== 'unknown') return;
    let active = true;
    setStatus('refreshing');
    void initializeAuthSession({
      load: getCurrentAdmin,
      isActive: () => active,
      onAuthenticated: (admin) => {
        setCurrentAdmin(admin);
        setStatus('authenticated');
      },
      onUnauthenticated: () => {
        clear();
        setStatus('unauthenticated');
      },
    });

    return () => {
      active = false;
    };
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
