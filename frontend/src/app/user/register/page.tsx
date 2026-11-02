import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { UserAuthEntry } from '@/components/auth/UserAuthEntry';

export default function UserRegisterPage(): React.JSX.Element {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-app-bg">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      }
    >
      <UserAuthEntry mode="register" />
    </React.Suspense>
  );
}
