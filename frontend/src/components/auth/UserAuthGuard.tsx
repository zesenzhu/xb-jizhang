'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { Loader2 } from 'lucide-react';

export interface UserAuthGuardProps {
  children: React.ReactNode;
}

export function UserAuthGuard({ children }: UserAuthGuardProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, authChecked, checkAuth } = useAppStore();

  React.useEffect(() => {
    let isMounted = true;

    async function verify(): Promise<void> {
      if (!authChecked) {
        await checkAuth();
      }
      if (isMounted) {
        const currentAuthed = useAppStore.getState().isAuthenticated;
        if (!currentAuthed) {
          const redirectQuery = encodeURIComponent(pathname);
          router.replace(`/login?redirect=${redirectQuery}`);
        }
      }
    }

    void verify();

    return () => {
      isMounted = false;
    };
  }, [authChecked, checkAuth, pathname, router]);

  // 当正在探活或未登录跳转中时，展示平滑加载态
  if (!authChecked || !isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 text-slate-500 gap-3">
        <Loader2 className="size-8 animate-spin text-emerald-600" />
        <p className="text-xs">正在校验安全会话...</p>
      </div>
    );
  }

  return <>{children}</>;
}

