'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/api/user-auth-api';
import { getLoginRedirectUrl } from '@/lib/routing/routes';
import { useUserAuthStore } from '@/store/userAuthStore';

export function UserAuthBoundary({ children }: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const status = useUserAuthStore((state) => state.status);
  const setCurrentUser = useUserAuthStore((state) => state.setCurrentUser);
  const setStatus = useUserAuthStore((state) => state.setStatus);
  const clear = useUserAuthStore((state) => state.clear);

  useEffect(() => {
    if (status !== 'unknown') return;
    let active = true;
    setStatus('refreshing');
    void getCurrentUser()
      .then((user) => {
        if (active) setCurrentUser(user);
      })
      .catch(() => {
        if (!active) return;
        clear();
      });

    return () => {
      active = false;
    };
  }, [clear, router, setCurrentUser, setStatus, status]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(getLoginRedirectUrl('user', pathname));
    }
  }, [pathname, router, status]);

  if (status !== 'authenticated') {
    return <p>正在验证用户登录状态...</p>;
  }
  return <>{children}</>;
}
