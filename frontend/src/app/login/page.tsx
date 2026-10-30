'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthCard } from '@/components/auth/AuthCard';
import { useAppStore } from '@/store/useAppStore';
import { Loader2 } from 'lucide-react';

function LoginContent(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get('redirect') ?? '/user';

  const { isAuthenticated, authChecked, checkAuth } = useAppStore();

  React.useEffect(() => {
    if (!authChecked) {
      void checkAuth();
    }
  }, [authChecked, checkAuth]);

  React.useEffect(() => {
    if (authChecked && isAuthenticated) {
      router.replace(redirectTarget);
    }
  }, [authChecked, isAuthenticated, redirectTarget, router]);

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="size-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col justify-center px-4 py-8 sm:py-12 bg-gradient-to-b from-slate-50 via-emerald-50/20 to-slate-100">
      <AuthCard onSuccess={() => router.replace(redirectTarget)} />
    </main>
  );
}

export default function LoginPage(): React.JSX.Element {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <Loader2 className="size-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <LoginContent />
    </React.Suspense>
  );
}
