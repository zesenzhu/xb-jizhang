'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AuthCard } from '@/components/auth/AuthCard';
import { getCurrentUser } from '@/lib/api/user-auth-api';
import { initializeAuthSession } from '@/lib/auth/initialize-auth';
import { getSafeRedirectTarget } from '@/lib/routing/routes';
import { useUserAuthStore } from '@/store/userAuthStore';

export interface UserAuthEntryProps {
  mode: 'login' | 'register';
}

export function UserAuthEntry({ mode }: UserAuthEntryProps): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = getSafeRedirectTarget(
    searchParams.get('redirect'),
    'user',
  );
  const status = useUserAuthStore((state) => state.status);
  const setCurrentUser = useUserAuthStore((state) => state.setCurrentUser);
  const setStatus = useUserAuthStore((state) => state.setStatus);
  const clear = useUserAuthStore((state) => state.clear);

  React.useEffect(() => {
    if (status !== 'unknown') return;
    let active = true;
    setStatus('refreshing');
    void initializeAuthSession({
      load: getCurrentUser,
      isActive: () => active,
      onAuthenticated: (user) => {
        setCurrentUser(user);
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
  }, [clear, setCurrentUser, setStatus, status]);

  React.useEffect(() => {
    if (status === 'authenticated') {
      router.replace(redirectTarget);
    }
  }, [redirectTarget, router, status]);

  if (
    status === 'unknown' ||
    status === 'refreshing' ||
    status === 'authenticated'
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="size-8 animate-spin text-ios-blue" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col justify-center px-4 py-8 sm:py-12 bg-gradient-to-b from-slate-50 via-ios-blue/10 to-slate-100">
      <AuthCard
        defaultMode={mode}
        onSuccess={() => router.replace(redirectTarget)}
      />
    </main>
  );
}
